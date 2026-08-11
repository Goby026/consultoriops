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

// El trigger validate_session() ya garantiza RN04/RN05/RN06/RN09 a nivel de base
// de datos; esta función centraliza la autorización y devuelve errores legibles
// antes de la operación (SRS 6.6). Errores de negocio viajan como 200 con
// { error } para que el cliente muestre el mensaje (supabase-js deja
// FunctionsHttpError.context = {} en respuestas no-2xx).
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

  let payload: { action?: string; tenantId?: string; appointmentId?: string }
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
  if (!role || role.role?.code !== 'professional') {
    return json({ error: 'Solo el rol profesional puede registrar sesiones clínicas' }, 403)
  }

  if (action === 'create_session') {
    const { appointmentId } = payload
    if (!appointmentId) {
      return json({ error: 'appointmentId es obligatorio' })
    }

    // RN04: la cita debe estar ATENDIDA y pertenecer al consultorio.
    const { data: appointment } = await serviceClient
      .from('appointment')
      .select('id, status, professional_id, patient_id')
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (!appointment) {
      return json({ error: 'La cita no pertenece a este consultorio' })
    }
    if (appointment.status !== 'ATENDIDA') {
      return json({ error: 'Solo citas en estado ATENDIDA pueden generar sesiones' })
    }

    // RN06: solo el profesional de la cita.
    if (appointment.professional_id !== user.id) {
      return json({ error: 'Solo el profesional de la cita puede registrar la sesión' })
    }

    // RN05: una sesión por cita.
    const { data: existing } = await serviceClient
      .from('session')
      .select('id')
      .eq('appointment_id', appointmentId)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    if (existing) {
      return json({ error: 'Esta cita ya tiene una sesión registrada' })
    }

    // RN09: la primera sesión del paciente exige consentimiento informado vigente.
    const { count: priorSessions } = await serviceClient
      .from('session')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('patient_id', appointment.patient_id)
    if (priorSessions === 0) {
      const { data: consent } = await serviceClient
        .from('informed_consent')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('patient_id', appointment.patient_id)
        .eq('status', 'accepted')
        .or('valid_until.is.null,valid_until.gte.now')
        .limit(1)
        .maybeSingle()
      if (!consent) {
        return json({ error: 'No se puede registrar la primera sesión del paciente sin consentimiento informado vigente' })
      }
    }

    // El trigger validate_session() y el RLS resuelven auth.uid() del JWT del
    // caller; insertamos con el token del usuario (no service role) para que
    // RN06/RLS se evalúen contra el profesional autenticado.
    const { data: session, error: insertError } = await callerClient
      .from('session')
      .insert({
        tenant_id: tenantId,
        appointment_id: appointmentId,
        patient_id: appointment.patient_id,
        professional_id: user.id,
      })
      .select()
      .single()
    if (insertError) {
      return json({ error: insertError.message })
    }
    return json(session, 201)
  }

  return json({ error: 'Acción no soportada' })
})
