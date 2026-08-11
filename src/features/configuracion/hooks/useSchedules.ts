import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type {
  ClinicSchedule,
  ProfessionalSchedule,
  ScheduleException,
} from '@/lib/database.types'

export function useClinicSchedule(tenantId: string | null) {
  return useQuery({
    queryKey: ['clinic_schedule', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clinic_schedule')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('day_of_week')
        .order('start_time')
      if (error) throw error
      return (data ?? []) as ClinicSchedule[]
    },
  })
}

export function useProfessionalSchedules(tenantId: string | null) {
  return useQuery({
    queryKey: ['professional_schedule', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('professional_schedule')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('professional_id')
        .order('day_of_week')
        .order('start_time')
      if (error) throw error
      return (data ?? []) as ProfessionalSchedule[]
    },
  })
}

export function useScheduleExceptions(tenantId: string | null) {
  return useQuery({
    queryKey: ['schedule_exception', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_exception')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('date', { ascending: false })
        .order('start_time')
      if (error) throw error
      return (data ?? []) as ScheduleException[]
    },
  })
}
