import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useTenantSettings } from '@/features/tenants/hooks/useTenantSettings'
import { useServices } from '@/features/configuracion/hooks/useServices'
import { useClinicSchedule } from '@/features/configuracion/hooks/useSchedules'
import { dayLabel } from './dayLabels'
import type { Service } from '@/lib/database.types'

const MODALITY_LABELS: Record<string, string> = {
  in_person: 'Presencial',
  online: 'En línea',
  hybrid: 'Mixta',
}

function timeLabel(value: string) {
  return value.slice(0, 5)
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value)
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value || '—'}</span>
    </div>
  )
}

export function ConsultorioTab({ tenantId }: { tenantId: string }) {
  const settingsQuery = useTenantSettings(tenantId)
  const servicesQuery = useServices(tenantId)
  const scheduleQuery = useClinicSchedule(tenantId)

  const services = (servicesQuery.data ?? []).filter((s) => s.active)
  const blocks = (scheduleQuery.data ?? []).sort((a, b) => a.day_of_week - b.day_of_week)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Datos institucionales</CardTitle>
          <CardDescription>Información del consultorio activo (solo lectura).</CardDescription>
        </CardHeader>
        <CardContent>
          {settingsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div>
              <Row label="Razón social" value={settingsQuery.data?.legal_name} />
              <Row label="RUC" value={settingsQuery.data?.tax_id} />
              <Row label="Dirección" value={settingsQuery.data?.address} />
              <Row label="Teléfono" value={settingsQuery.data?.phone} />
              <Row label="Correo de contacto" value={settingsQuery.data?.email} />
              <Row label="Zona horaria" value={settingsQuery.data?.timezone} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Servicios</CardTitle>
          <CardDescription>Servicios activos y su tarifa vigente (solo lectura).</CardDescription>
        </CardHeader>
        <CardContent>
          {servicesQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin servicios activos.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Servicio</TableHead>
                  <TableHead className="text-right">Duración</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((s: Service) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.name}</p>
                      {s.description && (
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                      )}
                      <Badge variant="outline" className="mt-1">
                        {MODALITY_LABELS[s.modality] ?? s.modality}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{s.duration_minutes} min</TableCell>
                    <TableCell className="text-right">{formatPrice(s.price)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Horario del consultorio</CardTitle>
          <CardDescription>Horario general de atención (solo lectura).</CardDescription>
        </CardHeader>
        <CardContent>
          {scheduleQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin horario definido.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead>Horario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blocks.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>{dayLabel(b.day_of_week)}</TableCell>
                    <TableCell>
                      {timeLabel(b.start_time)} – {timeLabel(b.end_time)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
