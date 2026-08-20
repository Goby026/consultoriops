import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { PaymentMethod, PaymentPlan } from '@/lib/database.types'

export function usePaymentMethods(tenantId: string | null) {
  return useQuery({
    queryKey: ['payment_methods', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_method')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (data ?? []) as PaymentMethod[]
    },
  })
}

export function usePaymentPlans(tenantId: string | null) {
  return useQuery({
    queryKey: ['payment_plans', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_plan')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('sort_order')
        .order('name')
      if (error) throw error
      return (data ?? []) as PaymentPlan[]
    },
  })
}