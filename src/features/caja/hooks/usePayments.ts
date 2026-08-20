import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import type { Appointment, Patient, Payment, Service } from '@/lib/database.types'

export type CajaAppointmentRow = Appointment & {
  patient: Pick<Patient, 'first_name' | 'last_name'> | null
  service: Pick<Service, 'name'> | null
}

const APPOINTMENT_SELECT = ['*', 'patient(first_name, last_name)', 'service(name)'].join(', ')

export function useAppointmentsForCaja(tenantId: string | null) {
  return useQuery({
    queryKey: ['caja_appointments', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointment')
        .select(APPOINTMENT_SELECT)
        .eq('tenant_id', tenantId!)
        .order('scheduled_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as CajaAppointmentRow[]
    },
  })
}

export function usePayments(tenantId: string | null) {
  return useQuery({
    queryKey: ['payments', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('paid_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Payment[]
    },
  })
}

export function useInsertPayment(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      appointmentId,
      amount,
      paymentMethodId,
      notes,
    }: {
      appointmentId: string
      amount: number
      paymentMethodId?: string | null
      notes?: string
    }) => {
      const { error } = await supabase.from('payment').insert({
        tenant_id: tenantId,
        appointment_id: appointmentId,
        amount,
        payment_method_id: paymentMethodId || null,
        notes: notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Cobro registrado')
      queryClient.invalidateQueries({ queryKey: ['payments', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

export function useDeletePayment(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.from('payment').delete().eq('id', paymentId)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Cobro eliminado')
      queryClient.invalidateQueries({ queryKey: ['payments', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}