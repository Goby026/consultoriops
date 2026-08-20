import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { Role } from '@/lib/database.types'

export function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('role').select('*').order('id')
      if (error) throw error
      return (data ?? []) as Role[]
    },
  })
}

export type TenantMember = {
  id: string
  user_id: string
  role_id: number
  status: string
  valid_from: string | null
  valid_to: string | null
  max_appointments_per_day: number
  user_profile: { id: string; full_name: string; email: string | null } | null
  role: { id: number; code: string; name: string } | null
}

export function useTenantMembers(tenantId: string | null) {
  return useQuery({
    queryKey: ['tenant_members', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data: memberships, error: mError } = await supabase
        .from('tenant_membership')
        .select('id, user_id, role_id, status, valid_from, valid_to, max_appointments_per_day, role(id, code, name)')
        .eq('tenant_id', tenantId!)
      if (mError) throw mError

      const list = memberships ?? []
      const userIds = [...new Set(list.map((m) => m.user_id))]
      const profileMap = new Map<string, { id: string; full_name: string; email: string | null }>()

      if (userIds.length > 0) {
        const { data: profiles, error: pError } = await supabase
          .from('user_profile')
          .select('id, full_name, email')
          .in('id', userIds)
        if (pError) throw pError
        for (const p of profiles ?? []) {
          profileMap.set(p.id, p)
        }
      }

      return list.map((m) => ({
        ...m,
        user_profile: profileMap.get(m.user_id) ?? null,
      })) as unknown as TenantMember[]
    },
  })
}
