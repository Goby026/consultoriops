import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Patient, TreatmentPlan } from '@/lib/database.types'

export type TreatmentPlanStatus = 'active' | 'completed' | 'cancelled'

export type TreatmentPlanRow = TreatmentPlan & {
  patient: Pick<Patient, 'first_name' | 'last_name' | 'medical_record_number'> | null
}

export function useTreatmentPlans(tenantId: string | null) {
  return useQuery({
    queryKey: ['treatment_plans', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatment_plan')
        .select('*, patient(first_name, last_name, medical_record_number)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as unknown as TreatmentPlanRow[]
    },
  })
}

export type TreatmentPlanInput = {
  patientId: string
  professionalId: string
  objectives: string
  suggestedFrequency?: string
  durationWeeks?: number | null
  startsOn: string
  endsOn?: string
  notes?: string
}

export function useSaveTreatmentPlan(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: TreatmentPlanInput }) => {
      const payload = {
        objectives: values.objectives,
        suggested_frequency: values.suggestedFrequency?.trim() || null,
        duration_weeks: values.durationWeeks || null,
        starts_on: values.startsOn,
        ends_on: values.endsOn?.trim() || null,
        notes: values.notes?.trim() || null,
      }
      if (id) {
        const { error } = await supabase.from('treatment_plan').update(payload).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('treatment_plan').insert({
          tenant_id: tenantId,
          patient_id: values.patientId,
          professional_id: values.professionalId,
          ...payload,
        })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment_plans', tenantId] })
    },
  })
}

export function useUpdateTreatmentPlanStatus(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TreatmentPlanStatus }) => {
      const { error } = await supabase.from('treatment_plan').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatment_plans', tenantId] })
    },
  })
}
