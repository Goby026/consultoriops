import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Appointment, Patient, Service } from '@/lib/database.types'

function functionError(error: unknown): Error {
  const body = (error as { context?: { error?: string } } | null)?.context
  if (body?.error) return new Error(body.error)
  return error instanceof Error ? error : new Error(String(error))
}

export type AppointmentRow = Appointment & {
  patient: Pick<
    Patient,
    'first_name' | 'last_name' | 'medical_record_number' | 'identity_doc_number'
  > | null
  service: Pick<Service, 'name'> | null
}

const APPOINTMENT_SELECT = [
  '*',
  'patient(first_name, last_name, medical_record_number, identity_doc_number)',
  'service(name)',
].join(', ')

export function useAppointments(tenantId: string | null) {
  return useQuery({
    queryKey: ['appointments', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const pageSize = 500
      const { count } = await supabase
        .from('appointment')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
      const total = count ?? 0
      if (total === 0) return []
      const pageCount = Math.ceil(total / pageSize)

      const responses = await Promise.all(
        Array.from({ length: pageCount }, (_, i) =>
          supabase
            .from('appointment')
            .select(APPOINTMENT_SELECT)
            .eq('tenant_id', tenantId!)
            .order('scheduled_at', { ascending: false })
            .range(i * pageSize, i * pageSize + pageSize - 1),
        ),
      )
      for (const { error } of responses) {
        if (error) throw error
      }
      return responses.flatMap((r) => (r.data ?? []) as unknown as AppointmentRow[])
    },
  })
}

export function useCreateAppointment(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      patientId,
      professionalId,
      serviceId,
      scheduledAt,
      notes,
    }: {
      patientId: string
      professionalId: string
      serviceId: string
      scheduledAt: string
      notes?: string
    }) => {
      const { data, error } = await supabase.functions.invoke('appointment', {
        body: {
          action: 'create',
          tenantId,
          patientId,
          professionalId,
          serviceId,
          scheduledAt,
          notes: notes || null,
        },
      })
      if (error) throw functionError(error)
      const result = data as { error?: string }
      if (result.error) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useRescheduleAppointment(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ appointmentId, scheduledAt }: { appointmentId: string; scheduledAt: string }) => {
      const { data, error } = await supabase.functions.invoke('appointment', {
        body: { action: 'reschedule', tenantId, appointmentId, scheduledAt },
      })
      if (error) throw functionError(error)
      const result = data as { error?: string }
      if (result.error) throw new Error(result.error)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useCancelAppointment(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('appointment').update({ status: 'CANCELADA' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}

export function useMarkAttendance(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      attendance,
    }: {
      id: string
      attendance: 'PRESENT' | 'LATE' | 'ABSENT'
    }) => {
      const status = attendance === 'ABSENT' ? 'NO_ASISTIO' : 'ATENDIDA'
      const { error } = await supabase
        .from('appointment')
        .update({ status, attendance })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments', tenantId] })
      queryClient.invalidateQueries({ queryKey: ['availability'] })
    },
  })
}
