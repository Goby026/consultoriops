import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { AssessmentResult, Patient } from '@/lib/database.types'

export type AssessmentResultRow = AssessmentResult & {
  patient: Pick<Patient, 'first_name' | 'last_name' | 'medical_record_number'> | null
}

export type AssessmentScaleCode = 'PHQ-9' | 'GAD-7'

export function useAssessmentResults(tenantId: string | null) {
  return useQuery({
    queryKey: ['assessment_results', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assessment_result')
        .select('*, patient(first_name, last_name, medical_record_number)')
        .eq('tenant_id', tenantId!)
        .order('assessed_on', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as unknown as AssessmentResultRow[]
    },
  })
}

export type AssessmentResultInput = {
  patientId: string
  professionalId: string
  sessionId?: string | null
  scaleCode: AssessmentScaleCode
  totalScore: number
  severity: string
  notes?: string
  assessedOn: string
}

export function useSaveAssessmentResult(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: AssessmentResultInput }) => {
      const payload = {
        session_id: values.sessionId || null,
        scale_code: values.scaleCode,
        total_score: values.totalScore,
        severity: values.severity,
        notes: values.notes?.trim() || null,
        assessed_on: values.assessedOn,
      }
      if (id) {
        const { error } = await supabase.from('assessment_result').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('assessment_result').insert({
          tenant_id: tenantId,
          patient_id: values.patientId,
          professional_id: values.professionalId,
          ...payload,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assessment_results', tenantId] })
    },
  })
}