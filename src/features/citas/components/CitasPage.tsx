import { useMemo, useState } from 'react'
import { CalendarClock, CalendarPlus, Loader2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import { useSession } from '@/features/auth/hooks/useSession'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import {
  useAppointments,
  useCancelAppointment,
  useMarkAttendance,
} from '@/features/citas/hooks/useAppointments'
import type { AppointmentRow } from '@/features/citas/hooks/useAppointments'
import { AppointmentFormDialog } from './AppointmentFormDialog'
import { RescheduleDialog } from './RescheduleDialog'
import { dayKey, todayKey, formatTime } from '@/features/citas/utils'

const statusMeta: Record<string, { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  PROGRAMADA: { label: 'Programada', variant: 'secondary' },
  REPROGRAMADA: { label: 'Reprogramada', variant: 'secondary' },
  CANCELADA: { label: 'Cancelada', variant: 'destructive' },
  ATENDIDA: { label: 'Atendida', variant: 'secondary' },
  NO_ASISTIO: { label: 'No asistió', variant: 'outline' },
}

const attendanceMeta: Record<string, string> = {
  PRESENT: 'Asistió',
  LATE: 'Tardanza',
  ABSENT: 'No asistió',
}

type ViewMode = 'today' | 'range' | 'all'

export function CitasPage() {
  const { activeTenantId } = useActiveTenant()
  const { session } = useSession()
  const appointmentsQuery = useAppointments(activeTenantId)
  const membersQuery = useTenantMembers(activeTenantId)
  const membershipsQuery = useMemberships(session?.user.id)
  const cancelMutation = useCancelAppointment(activeTenantId ?? '')
  const attendanceMutation = useMarkAttendance(activeTenantId ?? '')

  const activeMembership = membershipsQuery.data?.find((m) => m.tenant_id === activeTenantId)
  const isAdmin = activeMembership?.role?.code === 'tenant_admin'
  const lockedProfessionalId = !isAdmin ? session?.user.id ?? '' : ''

  const [mode, setMode] = useState<ViewMode>('today')
  const [professionalFilter, setProfessionalFilter] = useState('all')
  const [date, setDate] = useState(todayKey())
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [rescheduleFor, setRescheduleFor] = useState<AppointmentRow | null>(null)

  const effectiveProfessionalFilter = lockedProfessionalId || professionalFilter

  const professionals = useMemo(
    () =>
      (membersQuery.data ?? []).filter(
        (m) => m.role?.code === 'professional' || m.role?.code === 'tenant_admin',
      ),
    [membersQuery.data],
  )

  const professionalName = (userId: string) =>
    professionals.find((p) => p.user_id === userId)?.user_profile?.full_name ||
    professionals.find((p) => p.user_id === userId)?.user_profile?.email ||
    'Profesional'

  const filteredAppointments = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (appointmentsQuery.data ?? []).filter((a) => {
      if (effectiveProfessionalFilter !== 'all' && a.professional_id !== effectiveProfessionalFilter) {
        return false
      }
      if (mode === 'today' && dayKey(a.scheduled_at) !== date) return false
      if (mode === 'range') {
        const key = dayKey(a.scheduled_at)
        if (fromDate && key < fromDate) return false
        if (toDate && key > toDate) return false
      }
      if (q) {
        const name = `${a.patient?.first_name ?? ''} ${a.patient?.last_name ?? ''}`.toLowerCase()
        const dni = (a.patient?.identity_doc_number ?? '').toLowerCase()
        if (!name.includes(q) && !dni.includes(q)) return false
      }
      return true
    })
  }, [
    appointmentsQuery.data,
    effectiveProfessionalFilter,
    mode,
    date,
    fromDate,
    toDate,
    search,
  ])

  const appointments = useMemo(
    () =>
      filteredAppointments
        .slice()
        .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at)),
    [filteredAppointments],
  )

  if (!activeTenantId) {
    return <p className="text-muted-foreground">Selecciona un consultorio para ver su agenda.</p>
  }

  const cancelAppointment = (a: AppointmentRow) => {
    if (!window.confirm('¿Cancelar esta cita?')) return
    cancelMutation.mutate(a.id, {
      onSuccess: () => toast.success('Cita cancelada'),
      onError: (error: Error) => toast.error(error.message),
    })
  }

  const markAttendance = (a: AppointmentRow, attendance: 'PRESENT' | 'LATE' | 'ABSENT') => {
    attendanceMutation.mutate(
      { id: a.id, attendance },
      {
        onSuccess: () => {
          const status = attendance === 'ABSENT' ? 'NO_ASISTIO' : 'ATENDIDA'
          toast.success(`Cita marcada como ${statusMeta[status].label.toLowerCase()}`)
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  const isBooked = (a: AppointmentRow) => a.status === 'PROGRAMADA' || a.status === 'REPROGRAMADA'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Citas y agenda</h1>
          <p className="text-muted-foreground">
            Agenda de citas del consultorio (RF14–RF18).
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <CalendarPlus className="mr-2 size-4" />
          Nueva cita
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agenda de citas</CardTitle>
          <CardDescription>
            {isAdmin
              ? 'Filtra por profesional, rango de fechas y paciente.'
              : 'Estás viendo solo tus citas.'}
          </CardDescription>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <div className="flex overflow-hidden rounded-md border">
              {(
                [
                  { id: 'today', label: 'Hoy' },
                  { id: 'range', label: 'Rango' },
                  { id: 'all', label: 'Todas' },
                ] as { id: ViewMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    mode === m.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {mode === 'today' && (
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-44"
              />
            )}
            {mode === 'range' && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-40"
                />
                <span className="text-muted-foreground">a</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-40"
                />
              </div>
            )}

            {isAdmin && (
              <div className="w-56">
                <Select
                  value={effectiveProfessionalFilter}
                  onValueChange={setProfessionalFilter}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los profesionales</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.user_profile?.full_name || p.user_profile?.email || 'Profesional'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o DNI…"
              className="w-56"
            />
          </div>
        </CardHeader>
        <CardContent>
          {appointmentsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay citas que coincidan con el filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hora</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Asistencia</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {appointments.map((a) => {
                    const meta = statusMeta[a.status] ?? statusMeta.PROGRAMADA
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="font-medium">{formatTime(a.scheduled_at)}</TableCell>
                        <TableCell>
                          {a.patient?.first_name} {a.patient?.last_name}
                          {(a.patient?.medical_record_number || a.patient?.identity_doc_number) && (
                            <div className="text-xs text-muted-foreground">
                              {a.patient?.medical_record_number}
                              {a.patient?.medical_record_number && a.patient?.identity_doc_number
                                ? ' · '
                                : ''}
                              {a.patient?.identity_doc_number ? `DNI ${a.patient.identity_doc_number}` : ''}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {a.service?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {professionalName(a.professional_id)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {a.attendance ? (
                            <span className="text-sm text-muted-foreground">
                              {attendanceMeta[a.attendance] ?? a.attendance}
                            </span>
                          ) : isBooked(a) ? (
                            <Select
                              value=""
                              onValueChange={(v) =>
                                markAttendance(a, v as 'PRESENT' | 'LATE' | 'ABSENT')
                              }
                            >
                              <SelectTrigger className="w-36">
                                <SelectValue placeholder="Marcar…" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="PRESENT">Asistió</SelectItem>
                                <SelectItem value="LATE">Tardanza</SelectItem>
                                <SelectItem value="ABSENT">No asistió</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {isBooked(a) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Reprogramar"
                                  onClick={() => setRescheduleFor(a)}
                                >
                                  <CalendarClock className="size-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Cancelar"
                                  onClick={() => cancelAppointment(a)}
                                >
                                  <XCircle className="size-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AppointmentFormDialog
        tenantId={activeTenantId}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <RescheduleDialog
        tenantId={activeTenantId}
        appointment={rescheduleFor}
        open={rescheduleFor !== null}
        onOpenChange={(next) => {
          if (!next) setRescheduleFor(null)
        }}
      />
    </div>
  )
}
