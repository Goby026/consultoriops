import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'
import { ActiveTenantContext } from './activeTenantContext'

const STORAGE_KEY = 'consultoriops.active-tenant'

function readStoredTenant(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function ActiveTenantProvider({ children }: { children: ReactNode }) {
  const [activeTenantId, setActiveTenantIdState] = useState<string | null>(() => readStoredTenant())

  const setActiveTenantId = useCallback((id: string) => {
    setActiveTenantIdState(id)
    try {
      window.localStorage.setItem(STORAGE_KEY, id)
    } catch {
      // sin persistencia la app sigue funcionando
    }
  }, [])

  const clearActiveTenant = useCallback(() => {
    setActiveTenantIdState(null)
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignorar
    }
  }, [])

  return (
    <ActiveTenantContext.Provider value={{ activeTenantId, setActiveTenantId, clearActiveTenant }}>
      {children}
    </ActiveTenantContext.Provider>
  )
}
