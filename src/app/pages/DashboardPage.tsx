import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useSession } from '@/features/auth/hooks/useSession'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { ProfessionalPanel } from '@/features/panel/components/ProfessionalPanel'
import { AdminPanel } from '@/features/panel/components/AdminPanel'
import { ReceptionistPanel } from '@/features/panel/components/ReceptionistPanel'

export function DashboardPage() {
  const { session } = useSession()
  const { activeTenantId } = useActiveTenant()
  const membershipsQuery = useMemberships(session?.user.id)
  const profileQuery = useProfile(session?.user.id)

  const activeMembership = membershipsQuery.data?.find((m) => m.tenant_id === activeTenantId)
  const roleCode = activeMembership?.role?.code ?? ''
  const isPlatformAdmin = profileQuery.data?.is_platform_admin === true

  if (!activeTenantId) {
    return <p className="text-muted-foreground">Selecciona un consultorio para ver el panel.</p>
  }

  if (roleCode === 'tenant_admin' || isPlatformAdmin) {
    return <AdminPanel tenantId={activeTenantId} />
  }

  if (roleCode === 'professional') {
    return (
      <ProfessionalPanel tenantId={activeTenantId} professionalId={session?.user.id ?? ''} />
    )
  }

  return <ReceptionistPanel tenantId={activeTenantId} />
}
