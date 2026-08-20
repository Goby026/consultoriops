import { Building2, CalendarDays, UserCheck } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from './KpiCard'
import { initials } from '@/lib/utils'
import { useDashboardStats } from '@/features/panel/hooks/useDashboardStats'

function formatDateTime(value: string) {
  const d = new Date(value)
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
}

export function ReceptionistPanel({ tenantId }: { tenantId: string }) {
  const stats = useDashboardStats(tenantId, null, false)
  const loading = stats.isLoading

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Panel</h1>
        <p className="text-muted-foreground">Agenda y asistencia del consultorio.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          icon={CalendarDays}
          label="Citas de hoy"
          value={String(stats.todayCount)}
          loading={loading}
        />
        <KpiCard
          icon={Building2}
          label="Próximas citas (7 días)"
          value={String(stats.upcoming.length)}
          loading={loading}
        />
        <KpiCard
          icon={UserCheck}
          label="Tasa de asistencia"
          value={stats.attendanceRate == null ? '—' : `${stats.attendanceRate}%`}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Próximas citas</CardTitle>
          <CardDescription>Agenda programada para los próximos 7 días.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin citas programadas.</p>
          ) : (
            stats.upcoming.slice(0, 12).map((a) => (
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
    </div>
  )
}
