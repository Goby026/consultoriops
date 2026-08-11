import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export type AvailabilitySlot = { slot_start: string; slot_end: string }

export function useAvailability(
  tenantId: string | null,
  professionalId: string | null,
  date: string | null,
  serviceId: string | null,
) {
  return useQuery({
    queryKey: ['availability', tenantId, professionalId, date, serviceId],
    enabled: Boolean(tenantId && professionalId && date && serviceId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_availability', {
        p_tenant_id: tenantId!,
        p_professional_id: professionalId!,
        p_date: date!,
        p_service_id: serviceId!,
      })
      if (error) throw error
      return (data ?? []) as AvailabilitySlot[]
    },
  })
}
