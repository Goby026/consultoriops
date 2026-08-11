import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import type { ReactNode } from 'react'
import { ActiveTenantProvider } from '@/features/tenants/hooks/ActiveTenantProvider'
import { ThemeProvider } from '@/features/theme/ThemeProvider'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ActiveTenantProvider>
          {children}
          <Toaster richColors position="top-right" />
        </ActiveTenantProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
