import { Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useSession } from '@/features/auth/hooks/useSession'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'

/**
 * Puerta del Portal del Paciente.
 * - Sin sesión -> /login
 * - Debe cambiar contraseña -> /cambiar-contrasena
 * - Con membresía rol patient -> portal (o fuerza el registro si aún no canjeó)
 * - Staff -> la app de gestión (/)
 * - Sin membresías -> /portal/registro para canjear el código de vinculación
 */
export function PortalGate({
  children,
  requireLinked = true,
}: {
  children: React.ReactNode
  requireLinked?: boolean
}) {
  const { session, loading } = useSession()
  const location = useLocation()
  const profileQuery = useProfile(session?.user.id)
  const membershipsQuery = useMemberships(session?.user.id)
  const { activeTenantId, setActiveTenantId } = useActiveTenant()

  const memberships = membershipsQuery.data ?? []
  const patientMemberships = memberships.filter((m) => m.role?.code === 'patient')
  const hasStaffRole = memberships.some((m) => m.role?.code !== 'patient')

  useEffect(() => {
    if (patientMemberships.length === 0) return
    if (patientMemberships.some((m) => m.tenant_id === activeTenantId)) return
    setActiveTenantId(patientMemberships[0].tenant_id)
  }, [patientMemberships, activeTenantId, setActiveTenantId])

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

  if (profileQuery.data?.must_change_password === true) {
    return <Navigate to="/cambiar-contrasena" replace />
  }

  if (patientMemberships.length > 0) {
    if (!requireLinked) return <Navigate to="/portal" replace />
    return <>{children}</>
  }

  if (hasStaffRole) return <Navigate to="/app" replace />

  if (requireLinked) return <Navigate to="/portal/registro" replace />

  return <>{children}</>
}