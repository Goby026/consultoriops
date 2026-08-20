import { Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/features/auth/hooks/useSession'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'

/**
 * Puerta de autenticación y contexto de tenant (SRS §3.1, Flujo 1).
 * - Sin sesión -> /login
 * - Administrador de Plataforma sin consultorios -> consola de plataforma
 * - Con sesión pero sin consultorios asignados -> pantalla de acceso limitado
 * - Con un solo consultorio -> se selecciona automáticamente
 * - Con varios -> selección de consultorio activo
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession()
  const location = useLocation()
  const { activeTenantId, setActiveTenantId, clearActiveTenant } = useActiveTenant()

  const membershipsQuery = useMemberships(session?.user.id)
  const profileQuery = useProfile(session?.user.id)

  const isPlatformAdmin = profileQuery.data?.is_platform_admin === true

  useEffect(() => {
    if (!membershipsQuery.data) return

    const valid = membershipsQuery.data.filter((m) => m.tenant?.status === 'active')
    if (valid.length === 1) {
      setActiveTenantId(valid[0].tenant_id)
    } else if (valid.length === 0) {
      clearActiveTenant()
    } else if (valid.length > 1) {
      const stillActive = valid.some((m) => m.tenant_id === activeTenantId)
      if (!stillActive) {
        clearActiveTenant()
      }
    }
  }, [membershipsQuery.data, activeTenantId, setActiveTenantId, clearActiveTenant])

  if (loading || membershipsQuery.isLoading || profileQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // El administrador forzó el cambio de contraseña: bloquear el acceso hasta
  // que el usuario defina una nueva (excepto en la propia pantalla de cambio).
  if (profileQuery.data?.must_change_password === true && location.pathname !== '/cambiar-contrasena') {
    return <Navigate to="/cambiar-contrasena" replace />
  }

  const memberships = (membershipsQuery.data ?? []).filter((m) => m.tenant?.status === 'active')
  const pathname = location.pathname

  if (memberships.length === 0) {
    // El Administrador de Plataforma sin membresías usa la consola de plataforma.
    if (isPlatformAdmin) {
      // Evita auto-redirección infinita cuando ya estamos en /plataforma.
      return pathname !== '/plataforma' ? <Navigate to="/plataforma" replace /> : <>{children}</>
    }
    // Usuario sin consultorios: un paciente pendiente de vincularse canjea su código.
    return pathname !== '/portal/registro' ? <Navigate to="/portal/registro" replace /> : <>{children}</>
  }

  if (memberships.length > 1 && !activeTenantId) {
    return pathname !== '/select-tenant' ? <Navigate to="/select-tenant" replace /> : <>{children}</>
  }

  // Un paciente autenticado usa el portal, no la app de gestión.
  const activeMembership = memberships.find((m) => m.tenant_id === activeTenantId) ?? memberships[0]
  if (activeMembership?.role?.code === 'patient') {
    return <Navigate to="/portal" replace />
  }

  return <>{children}</>
}
