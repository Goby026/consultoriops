import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { UserProfile } from '@/lib/database.types'

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return data as UserProfile | null
    },
  })
}
