import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Patient, RiskAlert, Session } from '@/lib/database.types'

export type RiskLevel = 'alta' | 'media' | 'baja'
export type RiskStatus = 'open' | 'resolved'

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
}

export const RISK_LEVEL_VARIANT: Record<RiskLevel, 'secondary' | 'outline' | 'destructive'> = {
  alta: 'destructive',
  media: 'outline',
  baja: 'secondary',
}

export type RiskAlertRow = RiskAlert & {
  patient: Pick<Patient, 'first_name' | 'last_name' | 'medical_record_number'> | null
  session: Pick<Session, 'started_at'> | null
}

export function useRiskAlerts(tenantId: string | null) {
  return useQuery({
    queryKey: ['risk_alerts', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('risk_alert')
        .select('*, patient(first_name, last_name, medical_record_number), session(started_at)')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return (data ?? []) as unknown as RiskAlertRow[]
    },
  })
}

export function useSaveRiskAlert(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      patientId,
      sessionId,
      professionalId,
      level,
      description,
    }: {
      patientId: string
      sessionId: string | null
      professionalId: string
      level: RiskLevel
      description?: string
    }) => {
      const { error } = await supabase.from('risk_alert').insert({
        tenant_id: tenantId,
        patient_id: patientId,
        session_id: sessionId,
        professional_id: professionalId,
        level,
        description: description?.trim() || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk_alerts', tenantId] })
    },
  })
}

export function useResolveRiskAlert(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await supabase
        .from('risk_alert')
        .update({
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          resolved_by: userId,
        })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk_alerts', tenantId] })
    },
  })
}