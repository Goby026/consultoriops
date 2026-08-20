import { Check, ShieldAlert } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { initials } from '@/lib/utils'
import {
  RISK_LEVEL_LABELS,
  RISK_LEVEL_VARIANT,
  type RiskAlertRow,
} from '@/features/sesiones/hooks/useRiskAlerts'

function formatDate(value: string) {
  const d = new Date(value)
  return (
    d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
  )
}

export function RiskAlertsCard({
  alerts,
  loading,
  onResolve,
}: {
  alerts: RiskAlertRow[]
  loading?: boolean
  onResolve: (id: string) => void
}) {
  const open = alerts.filter((a) => a.status === 'open')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas de riesgo</CardTitle>
        <CardDescription>
          Visible solo para el administrador y el profesional responsable (RF27).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : open.length === 0 ? (
          <EmptyState
            icon={ShieldAlert}
            title="Sin alertas de riesgo abiertas"
            hint="Las alertas se generan al marcar una sesión con riesgo alto en Atención Clínica."
          />
        ) : (
          open.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
            >
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
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      variant={RISK_LEVEL_VARIANT[a.level as keyof typeof RISK_LEVEL_VARIANT] ?? 'outline'}
                    >
                      {RISK_LEVEL_LABELS[a.level as keyof typeof RISK_LEVEL_LABELS] ?? a.level}
                    </Badge>
                    {formatDate(a.created_at)}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onResolve(a.id)} title="Marcar como resuelta">
                <Check className="mr-2 size-4" />
                Resolver
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}