import {
  Building2,
  CalendarDays,
  ClipboardList,
  Clock,
  FilePlus2,
  Target,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/EmptyState'
import { KpiCard } from './KpiCard'
import { RiskAlertsCard } from './RiskAlertsCard'
import { useDashboardStats } from '@/features/panel/hooks/useDashboardStats'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import { useRiskAlerts, useResolveRiskAlert } from '@/features/sesiones/hooks/useRiskAlerts'
import { useSession } from '@/features/auth/hooks/useSession'

export function AdminPanel({ tenantId }: { tenantId: string }) {
  const stats = useDashboardStats(tenantId, null)
  const membersQuery = useTenantMembers(tenantId)
  const { session } = useSession()
  const riskAlertsQuery = useRiskAlerts(tenantId)
  const resolveAlertMutation = useResolveRiskAlert(tenantId)
  const loading = stats.isLoading

  const clinical = (membersQuery.data ?? []).filter((m) =>
    ['professional', 'tenant_admin'].includes(m.role?.code ?? ''),
  )

  const rows = clinical
    .map((m) => {
      const sessions = stats.sessions.filter((s) => s.professional_id === m.user_id)
      const plans = stats.plans.filter((p) => p.professional_id === m.user_id)
      const patients = new Set(sessions.map((s) => s.patient_id)).size
      const hours = sessions.reduce((acc, s) => acc + (s.appointment?.duration_minutes ?? 0), 0) / 60
      return {
        name: m.user_profile?.full_name || m.user_profile?.email || m.user_id,
        sessions: sessions.length,
        open: sessions.filter((s) => s.status === 'open').length,
        hours: Math.round(hours * 10) / 10,
        patients,
        plansActive: plans.filter((p) => p.status === 'active').length,
        role: m.role?.name ?? '',
      }
    })
    .sort((a, b) => b.sessions - a.sessions)

  const resolveAlert = (id: string) => {
    if (!session?.user.id) return
    resolveAlertMutation.mutate(
      { id, userId: session.user.id },
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
        <p className="text-muted-foreground">Métricas del consultorio activo.</p>
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
          loading={loading}
        />
        <KpiCard
          icon={Users}
          label="Pacientes"
          value={String(stats.patientsTotal)}
          sub={`${stats.patientsNewThisMonth} nuevos este mes`}
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
          icon={FilePlus2}
          label="Tasa de asistencia"
          value={stats.attendanceRate == null ? '—' : `${stats.attendanceRate}%`}
          loading={loading}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Atención por profesional</CardTitle>
          <CardDescription>Desglose de la actividad de cada psicólogo del consultorio.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-4 text-sm text-muted-foreground">Cargando…</p>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Sin profesionales clínicos activos"
              hint="Invita profesionales o configura sus roles para ver métricas por persona."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profesional</TableHead>
                  <TableHead className="text-right">Atenciones</TableHead>
                  <TableHead className="text-right">Abiertas</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Pacientes</TableHead>
                  <TableHead className="text-right">Planes activos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell>
                      <span className="font-medium">{r.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {r.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.sessions}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{r.open}</TableCell>
                    <TableCell className="text-right">{r.hours} h</TableCell>
                    <TableCell className="text-right">{r.patients}</TableCell>
                    <TableCell className="text-right">{r.plansActive}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <RiskAlertsCard
        alerts={riskAlertsQuery.data ?? []}
        loading={riskAlertsQuery.isLoading}
        onResolve={resolveAlert}
      />
    </div>
  )
}
