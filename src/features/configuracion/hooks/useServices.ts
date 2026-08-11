import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Service, ServicePrice } from '@/lib/database.types'

export function useServices(tenantId: string | null) {
  return useQuery({
    queryKey: ['services', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (data ?? []) as Service[]
    },
  })
}

export function useServicePrices(tenantId: string | null) {
  return useQuery({
    queryKey: ['service_prices', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_price')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('valid_from', { ascending: false })
      if (error) throw error
      return (data ?? []) as ServicePrice[]
    },
  })
}
