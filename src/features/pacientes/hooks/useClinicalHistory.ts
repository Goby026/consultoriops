import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type {
  Anamnesis,
  Appointment,
  AssessmentResult,
  Diagnosis,
  ProgressNote,
  RiskAlert,
  Service,
  Session,
  TreatmentPlan,
} from '@/lib/database.types'

export type ClinicalSession = Session & {
  appointment:
    | (Pick<Appointment, 'scheduled_at' | 'status' | 'attendance'> & {
        service: Pick<Service, 'name' | 'duration_minutes'> | null
      })
    | null
  anamnesis: Anamnesis | null
  progress_note: ProgressNote[]
  diagnosis: Diagnosis[]
  assessment_result: AssessmentResult[]
  risk_alert: RiskAlert[]
}

export function useClinicalHistory(tenantId: string | null, patientId: string | undefined) {
  return useQuery({
    queryKey: ['clinical_history', tenantId, patientId],
    enabled: Boolean(tenantId) && Boolean(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('session')
        .select(
          `*,
          appointment(service(name, duration_minutes), scheduled_at, status, attendance),
          anamnesis(*),
          progress_note(*),
          diagnosis(*),
          assessment_result(*),
          risk_alert(*)`,
        )
        .eq('tenant_id', tenantId!)
        .eq('patient_id', patientId!)
        .order('started_at', { ascending: false })
      if (error) throw error
      // PostgREST puede devolver el embed 1:1 de anamnesis como objeto o array; se normaliza.
      const rows = (data ?? []) as unknown as Array<
        ClinicalSession & { anamnesis?: Anamnesis | Anamnesis[] | null }
      >
      return rows.map((s) => ({
        ...s,
        anamnesis: Array.isArray(s.anamnesis) ? s.anamnesis[0] ?? null : s.anamnesis ?? null,
      })) as unknown as ClinicalSession[]
    },
  })
}

// treatment_plan es a nivel de paciente (sin FK a session), se consulta aparte.
export function usePatientTreatmentPlans(tenantId: string | null, patientId: string | undefined) {
  return useQuery({
    queryKey: ['patient_treatment_plans', tenantId, patientId],
    enabled: Boolean(tenantId) && Boolean(patientId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatment_plan')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('patient_id', patientId!)
        .order('starts_on', { ascending: false })
      if (error) throw error
      return (data ?? []) as TreatmentPlan[]
    },
  })
}

export async function logClinicalHistoryAccess(tenantId: string, patientId: string) {
  const { error } = await supabase.rpc('log_clinical_history_access', {
    p_tenant_id: tenantId,
    p_patient_id: patientId,
  })
  return { error }
}