import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Appointment, Patient, Service, Tenant } from '@/lib/database.types'

export type PortalFicha = Patient & { tenant: Pick<Tenant, 'name' | 'slug'> | null }

export type PortalAppointment = Appointment & {
  service: Pick<Service, 'name'> | null
  professional_name: string | null
}

export type PortalProfessional = { id: string; full_name: string; email: string | null }

export type HistoryRow = {
  started_at: string
  service_name: string
  professional_name: string
  status: string
}

export type ConsentInfo = {
  signed: boolean
  signedAt: string | null
  version: number | null
}

export function usePortalFicha(tenantId: string | null, userId: string | undefined) {
  return useQuery({
    queryKey: ['portal_ficha', tenantId, userId],
    enabled: Boolean(tenantId && userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient')
        .select('*, tenant(name, slug)')
        .eq('tenant_id', tenantId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data as PortalFicha | null
    },
  })
}

export function usePortalProfessionals(tenantId: string | null) {
  return useQuery({
    queryKey: ['portal_professionals', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_tenant_professionals', {
        p_tenant_id: tenantId!,
      })
      if (error) throw error
      return (data ?? []) as PortalProfessional[]
    },
  })
}

export function usePortalAppointments(tenantId: string | null) {
  return useQuery({
    queryKey: ['portal_appointments', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment')
        .select('*, service(name)')
        .eq('tenant_id', tenantId!)
        .order('scheduled_at', { ascending: false })
      if (error) throw error
      const rows = (data ?? []) as unknown as PortalAppointment[]
      const profIds = [...new Set(rows.map((r) => r.professional_id))]
      if (profIds.length > 0) {
        const { data: profs, error: profErr } = await supabase
          .from('user_profile')
          .select('id, full_name')
          .in('id', profIds)
        if (profErr) throw profErr
        const map = new Map((profs ?? []).map((p) => [p.id, p.full_name]))
        for (const r of rows) r.professional_name = map.get(r.professional_id) ?? null
      } else {
        for (const r of rows) r.professional_name = null
      }
      return rows
    },
  })
}

export function usePortalHistory(tenantId: string | null) {
  return useQuery({
    queryKey: ['portal_history', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_patient_history_summary')
      if (error) throw error
      return (data ?? []) as HistoryRow[]
    },
  })
}

export function usePortalConsent(tenantId: string | null, fichaId: string | null) {
  return useQuery({
    queryKey: ['portal_consent', tenantId, fichaId],
    enabled: Boolean(tenantId && fichaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('informed_consent')
        .select('signed_at, status, document_template(version)')
        .eq('tenant_id', tenantId!)
        .eq('patient_id', fichaId!)
        .order('signed_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data || data.status !== 'accepted') {
        return { signed: false, signedAt: null, version: null } satisfies ConsentInfo
      }
      const tpl = data as unknown as { document_template: { version: number } | null }
      return {
        signed: true,
        signedAt: data.signed_at,
        version: tpl.document_template?.version ?? null,
      } satisfies ConsentInfo
    },
  })
}

export function useConsentTemplate(tenantId: string | null) {
  return useQuery({
    queryKey: ['portal_consent_template', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_template')
        .select('title, version, content')
        .eq('tenant_id', tenantId!)
        .eq('code', 'informed_consent')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as { title: string; version: number; content: string } | null
    },
  })
}

export function useRedeemCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      code,
      identity,
    }: {
      code: string
      identity: Record<string, string>
    }) => {
      const { data, error } = await supabase.rpc('redeem_by_code', {
        p_code: code,
        p_identity: identity,
      })
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] })
    },
  })
}

export function useCancelPortalAppointment(tenantId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (appointmentId: string) => {
      const { error } = await supabase.rpc('cancel_own_appointment', {
        p_appointment_id: appointmentId,
      })
      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_appointments', tenantId] })
    },
  })
}

export function useAcceptConsent(tenantId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('accept_consent')
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_consent', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['portal_history', tenantId] })
    },
  })
}

export function useCreatePortalAppointment(tenantId: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      fichaId,
      professionalId,
      serviceId,
      scheduledAt,
    }: {
      fichaId: string
      professionalId: string
      serviceId: string
      scheduledAt: string
    }) => {
      const { data, error } = await supabase
        .from('appointment')
        .insert({
          tenant_id: tenantId!,
          patient_id: fichaId,
          professional_id: professionalId,
          service_id: serviceId,
          scheduled_at: scheduledAt,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal_appointments', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}