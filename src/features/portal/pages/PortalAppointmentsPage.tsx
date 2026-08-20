import { CalendarDays, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { EmptyState } from '@/components/EmptyState'
import {
  useCancelPortalAppointment,
  usePortalAppointments,
} from '@/features/portal/hooks/usePortal'
import type { PortalAppointment } from '@/features/portal/hooks/usePortal'

const STATUS_LABEL: Record<string, string> = {
  PROGRAMADA: 'Programada',
  REPROGRAMADA: 'Reprogramada',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
  NO_ASISTIO: 'No asistió',
}

function canCancel(a: PortalAppointment) {
  if (a.status !== 'PROGRAMADA' && a.status !== 'REPROGRAMADA') return false
  if (new Date(a.scheduled_at) <= new Date()) return false
  const created = new Date(a.created_at)
  return Date.now() - created.getTime() <= 24 * 3600 * 1000
}

export function PortalAppointmentsPage() {
  const { activeTenantId } = useActiveTenant()
  const appointmentsQuery = usePortalAppointments(activeTenantId)
  const cancelMutation = useCancelPortalAppointment(activeTenantId)

  const handleCancel = (a: PortalAppointment) => {
    cancelMutation.mutate(a.id, {
      onSuccess: () => toast.success('Cita cancelada'),
      onError: (error: Error) => toast.error(error.message),
    })
  }

  if (appointmentsQuery.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const appointments = appointmentsQuery.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis citas</CardTitle>
        <CardDescription>Puedes cancelar una cita dentro de las 24 horas desde su creación.</CardDescription>
      </CardHeader>
      <CardContent>
        {appointments.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Aún no tienes citas"
            hint="Solicita tu primera cita desde el menú Solicitar cita."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha y hora</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <p className="text-sm font-medium">
                        {new Date(a.scheduled_at).toLocaleDateString('es-PE', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.scheduled_at).toLocaleTimeString('es-PE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </TableCell>
                    <TableCell>{a.service?.name ?? '—'}</TableCell>
                    <TableCell>{a.professional_name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'CANCELADA' ? 'destructive' : 'secondary'}>
                        {STATUS_LABEL[a.status] ?? a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {canCancel(a) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(a)}
                          disabled={cancelMutation.isPending}
                        >
                          <XCircle className="mr-2 size-4" />
                          Cancelar
                        </Button>
                      )}
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