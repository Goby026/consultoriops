import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Diagnosis, Patient } from '@/lib/database.types'

export type DiagnosisRow = Diagnosis & {
  patient: Pick<Patient, 'first_name' | 'last_name' | 'medical_record_number'> | null
}

export function useDiagnoses(tenantId: string | null) {
  return useQuery({
    queryKey: ['diagnoses', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diagnosis')
        .select('*, patient(first_name, last_name, medical_record_number)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as unknown as DiagnosisRow[]
    },
  })
}

export type DiagnosisInput = {
  patientId: string
  professionalId: string
  sessionId?: string | null
  icd11Code: string
  icd11Label: string
  description?: string
  isPrimary?: boolean
}

export function useSaveDiagnosis(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: DiagnosisInput }) => {
      const payload = {
        session_id: values.sessionId || null,
        icd11_code: values.icd11Code.trim(),
        icd11_label: values.icd11Label.trim(),
        description: values.description?.trim() || null,
        is_primary: values.isPrimary ?? false,
      }
      if (id) {
        const { error } = await supabase.from('diagnosis').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('diagnosis').insert({
          tenant_id: tenantId,
          patient_id: values.patientId,
          professional_id: values.professionalId,
          ...payload,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['diagnoses', tenantId] })
    },
  })
}