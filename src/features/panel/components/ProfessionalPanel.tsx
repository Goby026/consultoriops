import { CalendarClock, CalendarDays, Clock, ClipboardList, Stethoscope, Target, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { KpiCard } from './KpiCard'
import { RiskAlertsCard } from './RiskAlertsCard'
import { initials } from '@/lib/utils'
import { useDashboardStats } from '@/features/panel/hooks/useDashboardStats'
import { useRiskAlerts, useResolveRiskAlert } from '@/features/sesiones/hooks/useRiskAlerts'

function formatDateTime(value: string) {
  const d = new Date(value)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export function ProfessionalPanel({
  tenantId,
  professionalId,
}: {
  tenantId: string
  professionalId: string
}) {
  const stats = useDashboardStats(tenantId, professionalId)
  const loading = stats.isLoading
  const riskAlertsQuery = useRiskAlerts(tenantId)
  const resolveAlertMutation = useResolveRiskAlert(tenantId)

  const resolveAlert = (id: string) => {
    resolveAlertMutation.mutate(
      { id, userId: professionalId },
      {
        onSuccess: () => toast.success('Alerta resuelta'),
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-muted-foreground">Tus métricas de atención clínica.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={ClipboardList}
          label="Atenciones realizadas"
          value={String(stats.totals.sessions)}
          sub={`${stats.totals.openSessions} abiertas`}
          loading={loading}
        />
        <KpiCard
          icon={Clock}
          label="Horas de sesión"
          value={`${stats.totals.hours} h`}
          sub="Duración planificada de la cita"
          loading={loading}
        />
        <KpiCard
          icon={Users}
          label="Pacientes atendidos"
          value={String(stats.totals.patientsAttended)}
          loading={loading}
        />
        <KpiCard
          icon={Target}
          label="Planes de tratamiento"
          value={String(stats.totals.plansActive + stats.totals.plansCompleted)}
          sub={`${stats.totals.plansActive} activos`}
          loading={loading}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={CalendarClock}
          label="Citas de hoy"
          value={String(stats.todayCount)}
          loading={loading}
        />
        <KpiCard
          icon={Stethoscope}
          label="Próximas citas (7 días)"
          value={String(stats.upcoming.length)}
          loading={loading}
        />
        <KpiCard
          icon={Users}
          label="Tasa de asistencia"
          value={stats.attendanceRate == null ? '—' : `${stats.attendanceRate}%`}
          sub="Presente + tardanza sobre registradas"
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Próximas citas</CardTitle>
            <CardDescription>Agenda programada para los próximos 7 días.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Sin citas programadas"
                hint="Cuando agendes citas aparecerán aquí los próximos 7 días."
              />
            ) : (
              stats.upcoming.slice(0, 8).map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback>
                        {initials(`${a.patient?.first_name} ${a.patient?.last_name}`)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {a.patient?.first_name} {a.patient?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {a.service?.name ?? 'Servicio'} · {formatDateTime(a.scheduled_at)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">Programada</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas sesiones</CardTitle>
            <CardDescription>Tus sesiones clínicas más recientes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.sessions.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="Sin sesiones registradas"
                hint="Registra una sesión desde la sección Sesiones para verla aquí."
              />
            ) : (
              stats.sessions.slice(0, 8).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar className="size-9 shrink-0">
                      <AvatarFallback>
                        {initials(`${s.patient?.first_name} ${s.patient?.last_name}`)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {s.patient?.first_name} {s.patient?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(s.started_at)}</p>
                    </div>
                  </div>
                  <Badge variant={s.status === 'completed' ? 'outline' : 'secondary'}>
                    {s.status === 'completed' ? 'Completada' : 'Abierta'}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <RiskAlertsCard
        alerts={(riskAlertsQuery.data ?? []).filter((a) => a.professional_id === professionalId)}
        loading={riskAlertsQuery.isLoading}
        onResolve={resolveAlert}
      />
    </div>
  )
}
