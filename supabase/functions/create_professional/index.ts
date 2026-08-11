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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405)
  }

  const authHeader = req.headers.get('Authorization')

  // Cliente con la identidad del llamante para validar quién invoca.
  const callerClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader ?? '' } },
    auth: { persistSession: false },
  })

  const {
    data: { user },
    error: authError,
  } = await callerClient.auth.getUser()
  if (authError || !user) {
    return json({ error: 'No autorizado' }, 401)
  }

  let payload: {
    tenantId?: string
    name?: string
    email?: string
    roleId?: number
    password?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }

  const { tenantId, name, email, roleId, password } = payload
  if (!tenantId || !name || !email || !roleId || !password) {
    return json({ error: 'tenantId, name, email, roleId y password son obligatorios' }, 400)
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // Solo el Administrador de Consultorio del tenant puede registrar personal.
  const { data: member } = await serviceClient
    .from('tenant_membership')
    .select('status, role:role(code)')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member || member.status !== 'active' || member.role?.code !== 'tenant_admin') {
    return json({ error: 'Solo el Administrador de Consultorio puede registrar profesionales' }, 403)
  }

  // Rol asignable: debe existir y no ser de alcance plataforma.
  const { data: role } = await serviceClient
    .from('role')
    .select('id, platform_scope')
    .eq('id', roleId)
    .maybeSingle()
  if (!role || role.platform_scope) {
    return json({ error: 'Rol inválido o de alcance plataforma' }, 400)
  }

  // El correo no debe corresponder a un usuario ya registrado.
  const { data: existingProfile } = await serviceClient
    .from('user_profile')
    .select('id')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle()
  if (existingProfile) {
    return json({ error: 'Ya existe un usuario con ese correo' }, 409)
  }

  const { data: created, error: createError } = await serviceClient.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: name.trim() },
  })
  if (createError || !created?.user) {
    return json({ error: createError?.message ?? 'No se pudo crear el usuario' }, 400)
  }

  const { error: membershipError } = await serviceClient.from('tenant_membership').insert({
    tenant_id: tenantId,
    user_id: created.user.id,
    role_id: role.id,
    status: 'active',
  })
  if (membershipError) {
    return json({ error: membershipError.message }, 400)
  }

  return json({ user_id: created.user.id, email: created.user.email }, 201)
})
