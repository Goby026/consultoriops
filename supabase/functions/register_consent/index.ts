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
    patientId?: string
    templateId?: string
    evidenceUrl?: string | null
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }

  const { tenantId, patientId, templateId, evidenceUrl } = payload
  if (!tenantId || !patientId || !templateId) {
    return json({ error: 'tenantId, patientId y templateId son obligatorios' }, 400)
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // El personal clínico/administrativo del tenant puede registrar la aceptación
  // en nombre del paciente (SRS 6.4).
  const { data: role } = await serviceClient
    .from('tenant_membership')
    .select('role:role(code)')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!role || !['tenant_admin', 'professional', 'receptionist'].includes(role.role?.code)) {
    return json({ error: 'No tienes permisos para registrar consentimientos en este consultorio' }, 403)
  }

  const { data: patient } = await serviceClient
    .from('patient')
    .select('id, is_minor')
    .eq('id', patientId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!patient) {
    return json({ error: 'El paciente no pertenece a este consultorio' }, 400)
  }

  const { data: template } = await serviceClient
    .from('document_template')
    .select('id, is_active')
    .eq('id', templateId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!template) {
    return json({ error: 'La plantilla del documento no pertenece a este consultorio' }, 400)
  }
  if (!template.is_active) {
    return json({ error: 'La versión vigente del documento está inactiva' }, 400)
  }

  const { data: consent, error: insertError } = await serviceClient
    .from('informed_consent')
    .insert({
      tenant_id: tenantId,
      patient_id: patientId,
      document_template_id: templateId,
      accepted_by: user.id,
      evidence_url: evidenceUrl ?? null,
    })
    .select()
    .single()
  if (insertError) {
    return json({ error: insertError.message }, 400)
  }

  return json(consent, 201)
})
