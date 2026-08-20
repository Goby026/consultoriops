import { ClipboardList, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { EmptyState } from '@/components/EmptyState'
import { usePortalHistory } from '@/features/portal/hooks/usePortal'

const STATUS_LABEL: Record<string, string> = {
  COMPLETADA: 'Completada',
  EN_PROGRESO: 'En progreso',
  CANCELADA: 'Cancelada',
  PENDIENTE: 'Pendiente',
}

export function PortalHistoryPage() {
  const { activeTenantId } = useActiveTenant()
  const historyQuery = usePortalHistory(activeTenantId)

  if (historyQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const rows = historyQuery.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mi historial</CardTitle>
        <CardDescription>
          Resumen de tus sesiones. El contenido clínico es privado para tu profesional.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Aún no tienes sesiones registradas"
            hint="Tu historial se irá completando conforme avancen tus sesiones."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={`${r.started_at}-${i}`}>
                    <TableCell>
                      {new Date(r.started_at).toLocaleDateString('es-PE', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>{r.service_name}</TableCell>
                    <TableCell>{r.professional_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{STATUS_LABEL[r.status] ?? r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}