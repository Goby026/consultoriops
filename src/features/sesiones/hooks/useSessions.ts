import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Anamnesis, Patient, ProgressNote, Session } from '@/lib/database.types'

function functionError(error: unknown): Error {
  const body = (error as { context?: { error?: string } } | null)?.context
  if (body?.error) return new Error(body.error)
  return error instanceof Error ? error : new Error(String(error))
}

export type SessionRow = Session & {
  patient: Pick<Patient, 'first_name' | 'last_name' | 'medical_record_number'> | null
  appointment: { scheduled_at: string; service: { name: string } | null } | null
  anamnesis: Anamnesis[] | null
  progress_note: ProgressNote[] | null
}

export type PendingAppointment = {
  id: string
  patient_id: string
  professional_id: string
  service_id: string
  scheduled_at: string
  status: string
  attendance: string | null
  patient_first_name: string
  patient_last_name: string
  service_name: string
}

export type AnamnesisInput = {
  reason_for_consultation: string
  personal_background?: string
  family_background?: string
  problem_history?: string
  risk_assessment?: string
}

export function useSessions(tenantId: string | null) {
  return useQuery({
    queryKey: ['sessions', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session')
        .select(
          '*, patient(first_name, last_name, medical_record_number), appointment(scheduled_at, service(name)), anamnesis(*), progress_note(*)',
        )
        .eq('tenant_id', tenantId!)
        .order('started_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as unknown as SessionRow[]
    },
  })
}

export function usePendingSessionAppointments(tenantId: string | null) {
  return useQuery({
    queryKey: ['pending_sessions', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_pending_session_appointments', {
        p_tenant_id: tenantId!,
      })
      if (error) throw error
      return (data ?? []) as PendingAppointment[]
    },
  })
}

export function useCreateSession(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (appointmentId: string): Promise<Session> => {
      const { data, error } = await supabase.functions.invoke('session', {
        body: { action: 'create_session', tenantId, appointmentId },
      })
      if (error) throw functionError(error)
      const result = data as { error?: string } & Session
      if (result.error) throw new Error(result.error)
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['pending_sessions', tenantId] })
    },
  })
}

export function useSaveAnamnesis(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      patientId,
      values,
    }: {
      sessionId: string
      patientId: string
      values: AnamnesisInput
    }) => {
      const { error } = await supabase
        .from('anamnesis')
        .upsert(
          {
            tenant_id: tenantId,
            session_id: sessionId,
            patient_id: patientId,
            reason_for_consultation: values.reason_for_consultation,
            personal_background: values.personal_background?.trim() || null,
            family_background: values.family_background?.trim() || null,
            problem_history: values.problem_history?.trim() || null,
            risk_assessment: values.risk_assessment?.trim() || null,
          },
          { onConflict: 'session_id' },
        )
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', tenantId] })
    },
  })
}

export function useSaveProgressNote(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sessionId,
      patientId,
      values,
    }: {
      sessionId: string
      patientId: string
      values: { subjective: string; objective: string; analysis: string; plan: string }
    }) => {
      const { error } = await supabase.from('progress_note').insert({
        tenant_id: tenantId,
        session_id: sessionId,
        patient_id: patientId,
        subjective: values.subjective,
        objective: values.objective,
        analysis: values.analysis,
        plan: values.plan,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', tenantId] })
    },
  })
}
