import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  FileSignature,
  HeartPulse,
  Loader2,
  NotebookText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useSession } from '@/features/auth/hooks/useSession'
import { EmptyState } from '@/components/EmptyState'
import {
  usePortalAppointments,
  usePortalConsent,
  usePortalFicha,
  usePortalHistory,
} from '@/features/portal/hooks/usePortal'

const STATUS_LABEL: Record<string, string> = {
  PROGRAMADA: 'Programada',
  REPROGRAMADA: 'Reprogramada',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
}

export function PortalDashboardPage() {
  const { activeTenantId } = useActiveTenant()
  const { session } = useSession()
  const fichaQuery = usePortalFicha(activeTenantId, session?.user.id)
  const appointmentsQuery = usePortalAppointments(activeTenantId)
  const consentQuery = usePortalConsent(activeTenantId, fichaQuery.data?.id ?? null)
  const historyQuery = usePortalHistory(activeTenantId)

  const loading =
    fichaQuery.isLoading || appointmentsQuery.isLoading || consentQuery.isLoading || historyQuery.isLoading

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const ficha = fichaQuery.data
  const nextAppointment = (appointmentsQuery.data ?? [])
    .filter((a) => a.status === 'PROGRAMADA' || a.status === 'REPROGRAMADA')
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0]
  const upcoming = (appointmentsQuery.data ?? []).filter((a) => a.status === 'PROGRAMADA' || a.status === 'REPROGRAMADA')
  const signed = consentQuery.data?.signed === true
  const sessionsCount = (historyQuery.data ?? []).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">
          Hola, {ficha?.first_name ?? session?.user.user_metadata.full_name ?? 'bienvenido'} 👋
        </h1>
        <p className="text-muted-foreground">
          {ficha?.tenant?.name ?? 'Consultorio'} · N.° {ficha?.medical_record_number ?? '—'}
        </p>
      </div>

      {!signed && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                <FileSignature className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Consentimiento pendiente</p>
                <p className="text-xs text-muted-foreground">
                  Firma tu consentimiento informado para autorizar tus sesiones.
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/portal/consentimiento">
                Firmar ahora <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-muted-foreground" />
              Próxima cita
            </CardTitle>
            <CardDescription>Tu próxima sesión agendada</CardDescription>
          </CardHeader>
          <CardContent>
            {nextAppointment ? (
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {new Date(nextAppointment.scheduled_at).toLocaleDateString('es-PE', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(nextAppointment.scheduled_at).toLocaleTimeString('es-PE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  · {nextAppointment.service?.name ?? 'Servicio'} · {nextAppointment.professional_name ?? '—'}
                </p>
                <Badge variant="secondary">{STATUS_LABEL[nextAppointment.status] ?? nextAppointment.status}</Badge>
              </div>
            ) : (
              <EmptyState
                icon={CalendarDays}
                title="Sin citas próximas"
                hint="Puedes solicitar una cita desde el menú Solicitar cita."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HeartPulse className="size-4 text-muted-foreground" />
              Sesiones
            </CardTitle>
            <CardDescription>Total de sesiones registradas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{sessionsCount}</p>
            <Link to="/portal/historial" className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
              Ver mi historial <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <NotebookText className="size-4 text-muted-foreground" />
              Citas activas
            </CardTitle>
            <CardDescription>Programadas o reprogramadas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{upcoming.length}</p>
            <Link to="/portal/citas" className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
              Gestionar mis citas <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}