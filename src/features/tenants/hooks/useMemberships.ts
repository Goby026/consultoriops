import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export type MembershipWithTenant = {
  id: string
  tenant_id: string
  role_id: number
  status: string
  valid_from: string | null
  valid_to: string | null
  tenant: {
    id: string
    slug: string
    name: string
    status: string
    tenant_settings: {
      logo_url: string | null
    } | null
  } | null
  role: {
    id: number
    code: string
    name: string
  } | null
}

export function useMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: ['memberships', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_membership')
        .select(
          'id, tenant_id, role_id, status, valid_from, valid_to, tenant(id, slug, name, status, tenant_settings(logo_url)), role(id, code, name)',
        )
        .eq('user_id', userId!)
        .eq('status', 'active')

      if (error) throw error
      return (data ?? []) as unknown as MembershipWithTenant[]
    },
  })
}
