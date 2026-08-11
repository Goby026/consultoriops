import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { TenantSettings } from '@/lib/database.types'

export function useTenantSettings(tenantId: string | null) {
  return useQuery({
    queryKey: ['tenant_settings', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle()
      if (error) throw error
      return data as TenantSettings | null
    },
  })
}
