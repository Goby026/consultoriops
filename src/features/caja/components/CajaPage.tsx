import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Banknote, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useSession } from '@/features/auth/hooks/useSession'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import { usePaymentMethods } from '@/features/configuracion/hooks/usePayments'
import {
  useAppointmentsForCaja,
  useDeletePayment,
  useInsertPayment,
  usePayments,
} from '@/features/caja/hooks/usePayments'
import type { CajaAppointmentRow } from '@/features/caja/hooks/usePayments'
import type { Payment } from '@/lib/database.types'

type CitaRow = CajaAppointmentRow & { paid: number; balance: number; eligible: boolean }

function today() {
  return new Date().toISOString().slice(0, 10)
}

function formatCurrency(value: number | string) {
  return `S/ ${Number(value).toFixed(2)}`
}

function patientNameOf(appt: CajaAppointmentRow | null | undefined) {
  if (!appt?.patient) return '—'
  return `${appt.patient.first_name} ${appt.patient.last_name}`.trim()
}

function ResumenCards({
  ingresos,
  cobros,
  pendiente,
}: {
  ingresos: number
  cobros: number
  pendiente: number
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Ingresos del periodo</CardDescription>
          <CardTitle className="text-2xl">{formatCurrency(ingresos)}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Cobros del periodo</CardDescription>
          <CardTitle className="text-2xl">{cobros}</CardTitle>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total pendiente</CardDescription>
          <CardTitle className="text-2xl">{formatCurrency(pendiente)}</CardTitle>
        </CardHeader>
      </Card>
    </div>
  )
}

function CobroForm({
  citas,
  canSeeAll,
  userId,
  methods,
  insertMutation,
}: {
  citas: CitaRow[]
  canSeeAll: boolean
  userId: string | undefined
  methods: { id: string; name: string }[]
  insertMutation: ReturnType<typeof useInsertPayment>
}) {
  const [patientId, setPatientId] = useState('')
  const [appointmentId, setAppointmentId] = useState('')
  const [amount, setAmount] = useState('')
  const [methodId, setMethodId] = useState('')
  const [notes, setNotes] = useState('')

  const available = canSeeAll ? citas : citas.filter((c) => c.professional_id === userId)

  const patientOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const c of available) {
      if (c.eligible) map.set(c.patient_id, patientNameOf(c))
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [available])

  const patientCitas = useMemo(
    () => available.filter((c) => c.patient_id === patientId && c.eligible),
    [available, patientId],
  )

  const handlePatientChange = (id: string) => {
    setPatientId(id)
    setAppointmentId('')
    setAmount('')
  }

  const handleCitaChange = (id: string) => {
    setAppointmentId(id)
    const cita = patientCitas.find((c) => c.id === id)
    setAmount(cita ? String(cita.balance) : '')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!appointmentId || !Number.isFinite(value) || value <= 0) return
    insertMutation.mutate({
      appointmentId,
      amount: value,
      paymentMethodId: methodId || null,
      notes,
    })
    setPatientId('')
    setAppointmentId('')
    setAmount('')
    setMethodId('')
    setNotes('')
  }

  return (
    <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-4">
      <div className="space-y-2">
        <Label htmlFor="cobro-patient">Paciente</Label>
        <Select value={patientId} onValueChange={handlePatientChange} required>
          <SelectTrigger id="cobro-patient" className="w-full">
            <SelectValue placeholder="Selecciona un paciente" />
          </SelectTrigger>
          <SelectContent>
            {patientOptions.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cobro-cita">Cita con saldo</Label>
        <Select value={appointmentId} onValueChange={handleCitaChange} disabled={!patientId} required>
          <SelectTrigger id="cobro-cita" className="w-full">
            <SelectValue placeholder="Selecciona una cita" />
          </SelectTrigger>
          <SelectContent>
            {patientCitas.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {new Date(c.scheduled_at).toLocaleDateString()} ·{' '}
                {c.service?.name ?? 'Sin servicio'} · saldo {formatCurrency(c.balance)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="cobro-amount">Monto</Label>
        <Input
          id="cobro-amount"
          type="number"
          min={0.01}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cobro-method">Método</Label>
        <Select value={methodId} onValueChange={setMethodId}>
          <SelectTrigger id="cobro-method" className="w-full">
            <SelectValue placeholder="Sin método" />
          </SelectTrigger>
          <SelectContent>
            {methods.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 md:col-span-3">
        <Label htmlFor="cobro-notes">Notas</Label>
        <Input
          id="cobro-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Opcional"
        />
      </div>
      <Button type="submit" disabled={insertMutation.isPending} className="md:col-span-1">
        {insertMutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Banknote className="mr-2 size-4" />}
        Registrar cobro
      </Button>
    </form>
  )
}

function CobrosTable({
  payments,
  apptMap,
  memberMap,
  methodMap,
  canDelete,
  deleteMutation,
}: {
  payments: Payment[]
  apptMap: Map<string, CitaRow>
  memberMap: Map<string, string>
  methodMap: Map<string, string>
  canDelete: boolean
  deleteMutation: ReturnType<typeof useDeletePayment>
}) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay cobros en el periodo seleccionado.
      </p>
    )
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fecha</TableHead>
          <TableHead>Paciente</TableHead>
          <TableHead>Profesional</TableHead>
          <TableHead>Servicio</TableHead>
          <TableHead>Método</TableHead>
          <TableHead>Monto</TableHead>
          <TableHead>Saldo restante</TableHead>
          {canDelete && <TableHead className="text-right">Acciones</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => {
          const appt = apptMap.get(p.appointment_id)
          return (
            <TableRow key={p.id}>
              <TableCell>{new Date(p.paid_at).toLocaleString()}</TableCell>
              <TableCell className="font-medium">{patientNameOf(appt)}</TableCell>
              <TableCell>{memberMap.get(appt?.professional_id ?? '') ?? '—'}</TableCell>
              <TableCell>{appt?.service?.name ?? '—'}</TableCell>
              <TableCell>{methodMap.get(p.payment_method_id ?? '') ?? '—'}</TableCell>
              <TableCell>{formatCurrency(p.amount)}</TableCell>
              <TableCell>{formatCurrency(appt?.balance ?? 0)}</TableCell>
              {canDelete && (
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(p.id)}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              )}
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}

export function CajaPage() {
  const { session } = useSession()
  const { activeTenantId } = useActiveTenant()
  const membershipsQuery = useMemberships(session?.user.id)
  const profileQuery = useProfile(session?.user.id)

  const activeMembership = membershipsQuery.data?.find((m) => m.tenant_id === activeTenantId)
  const roleCode = activeMembership?.role?.code ?? ''
  const isPlatformAdmin = profileQuery.data?.is_platform_admin === true
  const canSeeAll = isPlatformAdmin || roleCode === 'tenant_admin' || roleCode === 'receptionist'
  const canDelete = isPlatformAdmin || roleCode === 'tenant_admin'

  const appointmentsQuery = useAppointmentsForCaja(activeTenantId)
  const paymentsQuery = usePayments(activeTenantId)
  const membersQuery = useTenantMembers(activeTenantId)
  const methodsQuery = usePaymentMethods(activeTenantId)
  const insertPayment = useInsertPayment(activeTenantId ?? '')
  const deletePayment = useDeletePayment(activeTenantId ?? '')

  const [fromDate, setFromDate] = useState(today())
  const [toDate, setToDate] = useState(today())
  const [professionalFilter, setProfessionalFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')

  const appointments = appointmentsQuery.data ?? []
  const payments = paymentsQuery.data ?? []
  const members = membersQuery.data ?? []
  const methods = methodsQuery.data ?? []

  const paidByAppt = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of payments) {
      map.set(p.appointment_id, (map.get(p.appointment_id) ?? 0) + p.amount)
    }
    return map
  }, [payments])

  const citas = useMemo(
    () =>
      appointments.map((a) => {
        const paid = paidByAppt.get(a.id) ?? 0
        return {
          ...a,
          paid,
          balance: a.price - paid,
          eligible: a.status !== 'CANCELADA' && a.price - paid > 0,
        }
      }) as CitaRow[],
    [appointments, paidByAppt],
  )

  const apptMap = useMemo(() => {
    const map = new Map<string, CitaRow>()
    for (const c of citas) map.set(c.id, c)
    return map
  }, [citas])

  const memberMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of members) {
      if (m.user_profile?.full_name) map.set(m.user_id, m.user_profile.full_name)
    }
    return map
  }, [members])

  const methodMap = useMemo(() => new Map(methods.map((m) => [m.id, m.name])), [methods])

  const serviceOptions = useMemo(() => {
    const names = new Set<string>()
    for (const a of citas) if (a.service?.name) names.add(a.service.name)
    return [...names].sort()
  }, [citas])

  const professionalOptions = useMemo(
    () => members.filter((m) => m.role?.code === 'professional'),
    [members],
  )

  const filteredPayments = useMemo(
    () =>
      payments.filter((p) => {
        const day = p.paid_at.slice(0, 10)
        if (fromDate && day < fromDate) return false
        if (toDate && day > toDate) return false
        const appt = apptMap.get(p.appointment_id)
        if (professionalFilter !== 'all' && appt?.professional_id !== professionalFilter) {
          return false
        }
        if (serviceFilter !== 'all' && appt?.service?.name !== serviceFilter) return false
        return true
      }),
    [payments, fromDate, toDate, professionalFilter, serviceFilter, apptMap],
  )

  const ingresosPeriodo = filteredPayments.reduce((sum, p) => sum + p.amount, 0)
  const cobrosPeriodo = filteredPayments.length

  const visibleCitas = canSeeAll ? citas : citas.filter((c) => c.professional_id === session?.user.id)

  const pendienteTotal = visibleCitas.filter((c) => c.eligible).reduce((sum, c) => sum + c.balance, 0)

  const cuentasPorCobrar = useMemo(() => {
    const map = new Map<string, { patientName: string; total: number }>()
    for (const c of visibleCitas) {
      if (!c.eligible) continue
      const current = map.get(c.patient_id) ?? { patientName: patientNameOf(c), total: 0 }
      current.total += c.balance
      map.set(c.patient_id, current)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [visibleCitas])

  if (!activeTenantId) {
    return <p className="text-muted-foreground">Selecciona un consultorio para ver la caja.</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Caja</h1>
        <p className="text-muted-foreground">
          Registro de cobros, saldos y cuentas por cobrar del consultorio.
        </p>
      </div>

      <ResumenCards ingresos={ingresosPeriodo} cobros={cobrosPeriodo} pendiente={pendienteTotal} />

      <Card>
        <CardHeader>
          <CardTitle>Registrar cobro</CardTitle>
          <CardDescription>
            {canSeeAll
              ? 'Registra un cobro sobre cualquier cita con saldo pendiente.'
              : 'Puedes cobrar únicamente tus propias sesiones.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {appointmentsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : visibleCitas.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay citas con saldo pendiente para registrar cobros.
            </p>
          ) : (
            <CobroForm
              citas={visibleCitas}
              canSeeAll={canSeeAll}
              userId={session?.user.id}
              methods={methods}
              insertMutation={insertPayment}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cobros</CardTitle>
          <CardDescription>Filtra por periodo, profesional y servicio.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid items-end gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="filtro-desde">Desde</Label>
              <Input
                id="filtro-desde"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-hasta">Hasta</Label>
              <Input
                id="filtro-hasta"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-profesional">Profesional</Label>
              <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
                <SelectTrigger id="filtro-profesional" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionalOptions.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.user_profile?.full_name ?? '—'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="filtro-servicio">Servicio</Label>
              <Select value={serviceFilter} onValueChange={setServiceFilter}>
                <SelectTrigger id="filtro-servicio" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {serviceOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {paymentsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <CobrosTable
              payments={filteredPayments}
              apptMap={apptMap}
              memberMap={memberMap}
              methodMap={methodMap}
              canDelete={canDelete}
              deleteMutation={deletePayment}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cuentas por cobrar</CardTitle>
          <CardDescription>Saldo pendiente total por paciente.</CardDescription>
        </CardHeader>
        <CardContent>
          {cuentasPorCobrar.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay saldos pendientes. El consultorio está al día.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cuentasPorCobrar.map((row) => (
                  <TableRow key={row.patientName}>
                    <TableCell className="font-medium">{row.patientName}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="destructive">{formatCurrency(row.total)}</Badge>
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