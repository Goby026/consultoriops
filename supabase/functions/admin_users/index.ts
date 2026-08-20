import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Solo el Administrador de Plataforma puede usar esta función.
// Devuelve el id del llamante (o null si no es admin de plataforma).
async function platformAdminId(authHeader: string | null): Promise<string | null> {
  if (!authHeader) return null
  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser()
  if (authError || !user) return null
  const { data: profile } = await callerClient
    .from('user_profile')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single()
  return profile?.is_platform_admin === true ? user.id : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  const callerId = await platformAdminId(authHeader)
  if (!callerId) {
    return json({ error: 'No autorizado' }, 403)
  }

  let payload: { action?: string; userId?: string; newPassword?: string; forceChange?: boolean }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }

  const { action, userId, newPassword, forceChange } = payload

  if (action !== 'reset_password') {
    return json({ error: 'Acción no soportada' }, 400)
  }
  if (!userId || typeof newPassword !== 'string' || newPassword.length < 6) {
    return json({ error: 'userId y una contraseña de al menos 6 caracteres son obligatorios' }, 400)
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { error: updateError } = await serviceClient.auth.admin.updateUserById(userId, {
    password: newPassword,
  })
  if (updateError) {
    return json({ error: updateError.message }, 400)
  }

  if (forceChange) {
    const { error: flagError } = await serviceClient
      .from('user_profile')
      .update({ must_change_password: true })
      .eq('id', userId)
    if (flagError) {
      return json({ error: flagError.message }, 400)
    }
  }

  // Bitácora de trazabilidad: quién, cuándo y a quién se le reestableció.
  await serviceClient.from('audit_log').insert({
    tenant_id: null,
    user_id: callerId,
    action: 'auth.password_reset',
    table_name: 'auth.users',
    record_id: userId,
    metadata: { target_user_id: userId, force_change: Boolean(forceChange) },
  })

  return json({ ok: true }, 200)
})
