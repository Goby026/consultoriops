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

  const { data: profile } = await callerClient
    .from('user_profile')
    .select('is_platform_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_platform_admin) {
    return json({ error: 'Solo el Administrador de Plataforma puede crear consultorios' }, 403)
  }

  let payload: { name?: string; slug?: string; adminUserId?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }

  const { name, slug, adminUserId } = payload
  if (!name || !slug || !adminUserId) {
    return json({ error: 'name, slug y adminUserId son obligatorios' }, 400)
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: existing } = await serviceClient
    .from('tenant')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) {
    return json({ error: 'El slug ya está en uso' }, 409)
  }

  const { data: adminProfile } = await serviceClient
    .from('user_profile')
    .select('id')
    .eq('id', adminUserId)
    .maybeSingle()
  if (!adminProfile) {
    return json({ error: 'adminUserId no existe' }, 400)
  }

  const { data: role } = await serviceClient
    .from('role')
    .select('id')
    .eq('code', 'tenant_admin')
    .single()
  if (!role) {
    return json({ error: 'Rol tenant_admin no encontrado' }, 500)
  }

  const { data: tenant, error: tenantError } = await serviceClient
    .from('tenant')
    .insert({ name, slug })
    .select()
    .single()
  if (tenantError) {
    return json({ error: tenantError.message }, 400)
  }

  const { error: settingsError } = await serviceClient
    .from('tenant_settings')
    .insert({ tenant_id: tenant.id })
  if (settingsError) {
    return json({ error: settingsError.message }, 400)
  }

  const { data: membership, error: membershipError } = await serviceClient
    .from('tenant_membership')
    .insert({ tenant_id: tenant.id, user_id: adminUserId, role_id: role.id })
    .select()
    .single()
  if (membershipError) {
    return json({ error: membershipError.message }, 400)
  }

  // El admin de plataforma que crea también queda como tenant_admin para poder
  // gestionar el nuevo consultorio desde su menú lateral.
  const { error: callerMembershipError } = await serviceClient
    .from('tenant_membership')
    .upsert(
      { tenant_id: tenant.id, user_id: user.id, role_id: role.id, status: 'active' },
      { onConflict: 'tenant_id,user_id' },
    )
  if (callerMembershipError) {
    return json({ error: callerMembershipError.message }, 400)
  }

  const { error: templateError } = await serviceClient.from('document_template').insert({
    tenant_id: tenant.id,
    code: 'informed_consent',
    version: 1,
    title: 'Consentimiento Informado para Atención Psicológica',
    content:
      'CONSENTIMIENTO INFORMADO PARA ATENCIÓN PSICOLÓGICA\n\n' +
      'Yo, [NOMBRE DEL PACIENTE / REPRESENTANTE LEGAL], identificado(a) con [TIPO DE DOCUMENTO] N.° [NÚMERO], declaro que he sido informado(a) de manera clara y suficiente sobre la atención psicológica que se me brindará en este consultorio: su naturaleza, alcance, beneficios, riesgos y alternativas.\n\n' +
      'Declaro que se me ha explicado que:\n' +
      '1. La evaluación y el tratamiento tienen finalidad clínica y serán realizados por profesionales del consultorio.\n' +
      '2. La información compartida es confidencial y solo será accesible por el equipo autorizado del consultorio.\n' +
      '3. Los límites legales de la confidencialidad me fueron explicados.\n' +
      '4. Puedo solicitar información, revocar este consentimiento o suspender el proceso en cualquier momento.\n' +
      '5. Mi historia clínica será almacenada de forma segura y no compartida entre consultorios.\n\n' +
      'En consecuencia, otorgo mi consentimiento informado de forma libre y voluntaria para recibir la atención psicológica en este consultorio.',
  })
  if (templateError) {
    return json({ error: templateError.message }, 400)
  }

  return json({ tenant, membership }, 201)
})
