import { useState } from 'react'
import { useSession } from '@/features/auth/hooks/useSession'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { InstitucionalTab } from './InstitucionalTab'
import { ProfesionalesTab } from './ProfesionalesTab'
import { ServiciosTab } from './ServiciosTab'
import { HorariosTab } from './HorariosTab'
import { MiPerfilTab } from './MiPerfilTab'
import { MisHorariosTab } from './MisHorariosTab'
import { ConsultorioTab } from './ConsultorioTab'

const ADMIN_TABS = [
  { id: 'institucional', label: 'Datos institucionales' },
  { id: 'profesionales', label: 'Profesionales' },
  { id: 'servicios', label: 'Servicios' },
  { id: 'horarios', label: 'Horarios' },
] as const

const STAFF_TABS = [
  { id: 'mi-perfil', label: 'Mi perfil' },
  { id: 'mis-horarios', label: 'Mis horarios' },
  { id: 'consultorio', label: 'Consultorio' },
] as const

const READONLY_TABS = [
  { id: 'mi-perfil', label: 'Mi perfil' },
  { id: 'consultorio', label: 'Consultorio' },
] as const

type TabId = string

export function ConfiguracionPage() {
  const { session } = useSession()
  const { activeTenantId } = useActiveTenant()
  const [tab, setTab] = useState<TabId>('')

  const membershipsQuery = useMemberships(session?.user.id)
  const activeMembership = membershipsQuery.data?.find((m) => m.tenant_id === activeTenantId)
  const roleCode = activeMembership?.role?.code ?? ''
  const isAdmin = roleCode === 'tenant_admin'
  const isProfessional = roleCode === 'professional'

  const tabs = isAdmin ? ADMIN_TABS : isProfessional ? STAFF_TABS : READONLY_TABS
  const activeTab = tab && tabs.some((t) => t.id === tab) ? tab : tabs[0].id

  if (!activeTenantId) {
    return <p className="text-muted-foreground">Selecciona un consultorio para configurarlo.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          {isAdmin
            ? 'Parámetros del consultorio activo (Fase 2).'
            : 'Tus datos, horarios e información del consultorio.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === t.id
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'institucional' && <InstitucionalTab key={activeTenantId} tenantId={activeTenantId} />}
      {activeTab === 'profesionales' && <ProfesionalesTab key={activeTenantId} tenantId={activeTenantId} />}
      {activeTab === 'servicios' && <ServiciosTab key={activeTenantId} tenantId={activeTenantId} />}
      {activeTab === 'horarios' && <HorariosTab key={activeTenantId} tenantId={activeTenantId} />}
      {activeTab === 'mi-perfil' && (
        <MiPerfilTab key={activeTenantId} userId={session?.user.id ?? ''} tenantId={activeTenantId} />
      )}
      {activeTab === 'mis-horarios' && (
        <MisHorariosTab
          key={activeTenantId}
          tenantId={activeTenantId}
          userId={session?.user.id ?? ''}
        />
      )}
      {activeTab === 'consultorio' && <ConsultorioTab key={activeTenantId} tenantId={activeTenantId} />}
    </div>
  )
}
