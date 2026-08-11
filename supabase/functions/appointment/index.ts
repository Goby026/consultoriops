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

// El trigger validate_appointment() ya garantiza RN01/RN02/RN03/RN08 a nivel de
// base de datos; esta función centraliza la autorización y devuelve errores
// legibles antes de la operación (SRS 6.5).
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
    action?: string
    tenantId?: string
    patientId?: string
    professionalId?: string
    serviceId?: string
    scheduledAt?: string
    notes?: string | null
    appointmentId?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'Cuerpo JSON inválido' }, 400)
  }

  const { action, tenantId } = payload
  if (!tenantId || !action) {
    return json({ error: 'action y tenantId son obligatorios' })
  }

  const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  const { data: role } = await serviceClient
    .from('tenant_membership')
    .select('role:role(code)')
    .eq('tenant_id', tenantId)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()
  if (!role || !['tenant_admin', 'professional', 'receptionist'].includes(role.role?.code)) {
    return json({ error: 'No tienes permisos para gestionar citas en este consultorio' }, 403)
  }

  if (action === 'create') {
    const { patientId, professionalId, serviceId, scheduledAt, notes } = payload
    if (!patientId || !professionalId || !serviceId || !scheduledAt) {
      return json({ error: 'patientId, professionalId, serviceId y scheduledAt son obligatorios' })
    }

    // RN01: el paciente debe existir en el consultorio.
    const { data: patient } = await serviceClient
      .from('patient')
      .select('id')
      .eq('id', patientId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!patient) {
      return json({ error: 'El paciente no pertenece a este consultorio' })
    }

    // El servicio debe pertenecer al consultorio.
    const { data: service } = await serviceClient
      .from('service')
      .select('id')
      .eq('id', serviceId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!service) {
      return json({ error: 'El servicio no pertenece a este consultorio' })
    }

    const { data: appointment, error: insertError } = await serviceClient
      .from('appointment')
      .insert({
        tenant_id: tenantId,
        patient_id: patientId,
        professional_id: professionalId,
        service_id: serviceId,
        scheduled_at: scheduledAt,
        notes: notes ?? null,
      })
      .select()
      .single()
    if (insertError) {
      return json({ error: insertError.message })
    }
    return json(appointment, 201)
  }

  if (action === 'reschedule') {
    const { appointmentId, scheduledAt } = payload
    if (!appointmentId || !scheduledAt) {
      return json({ error: 'appointmentId y scheduledAt son obligatorios' })
    }

    const { data: existing } = await serviceClient
      .from('appointment')
      .select('id, status')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!existing) {
      return json({ error: 'La cita no pertenece a este consultorio' })
    }
    if (existing.status !== 'PROGRAMADA' && existing.status !== 'REPROGRAMADA') {
      return json({ error: 'Solo se puede reprogramar una cita programada' })
    }

    const { data: appointment, error: updateError } = await serviceClient
      .from('appointment')
      .update({ scheduled_at: scheduledAt, status: 'REPROGRAMADA' })
      .eq('id', appointmentId)
      .select()
      .single()
    if (updateError) {
      return json({ error: updateError.message })
    }
    return json(appointment)
  }

  return json({ error: 'Acción no soportada' })
})
