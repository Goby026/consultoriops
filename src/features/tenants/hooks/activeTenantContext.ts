import { createContext, useContext } from 'react'

export type ActiveTenantContextValue = {
  activeTenantId: string | null
  setActiveTenantId: (id: string) => void
  clearActiveTenant: () => void
}

export const ActiveTenantContext = createContext<ActiveTenantContextValue | null>(null)

export function useActiveTenant() {
  const ctx = useContext(ActiveTenantContext)
  if (!ctx) {
    throw new Error('useActiveTenant debe usarse dentro de ActiveTenantProvider')
  }
  return ctx
}
