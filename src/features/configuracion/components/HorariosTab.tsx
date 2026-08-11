import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileSpreadsheet, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
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
import { supabase } from '@/lib/supabaseClient'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import {
  useClinicSchedule,
  useProfessionalSchedules,
  useScheduleExceptions,
} from '@/features/configuracion/hooks/useSchedules'
import { dayLabel } from './dayLabels'
import { ImportScheduleDialog } from './ImportScheduleDialog'
import type {
  ClinicSchedule,
  ProfessionalSchedule,
  ScheduleException,
} from '@/lib/database.types'

const KIND_LABELS: Record<string, string> = {
  WORK: 'Trabajo',
  BREAK: 'Descanso',
  BLOCKED: 'Bloqueo',
  VACATION: 'Vacaciones',
  HOLIDAY: 'Feriado',
  OVERRIDE: 'Ajuste',
}

const KIND_VARIANTS: Record<string, 'secondary' | 'outline'> = {
  WORK: 'secondary',
  BREAK: 'outline',
  BLOCKED: 'outline',
  VACATION: 'outline',
  HOLIDAY: 'outline',
  OVERRIDE: 'outline',
}

function timeLabel(value: string) {
  return value.slice(0, 5)
}

function DayPicker({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <Select value={value} onValueChange={onChange} required>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Día" />
      </SelectTrigger>
      <SelectContent>
        {Array.from({ length: 7 }, (_, i) => (
          <SelectItem key={i} value={String(i)}>
            {dayLabel(i)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function TimeRange({
  start,
  end,
  onStart,
  onEnd,
}: {
  start: string
  end: string
  onStart: (value: string) => void
  onEnd: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input type="time" value={start} onChange={(e) => onStart(e.target.value)} required />
      <span className="text-muted-foreground">a</span>
      <Input type="time" value={end} onChange={(e) => onEnd(e.target.value)} required />
    </div>
  )
}

function ClinicScheduleSection({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const scheduleQuery = useClinicSchedule(tenantId)
  const [day, setDay] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('clinic_schedule')
        .insert({ tenant_id: tenantId, day_of_week: Number(day), start_time: start, end_time: end })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Bloque agregado al horario del consultorio')
      queryClient.invalidateQueries({ queryKey: ['clinic_schedule', tenantId] })
      setDay('')
      setStart('')
      setEnd('')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('clinic_schedule').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Bloque eliminado')
      queryClient.invalidateQueries({ queryKey: ['clinic_schedule', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (day && start && end) {
      add.mutate()
    }
  }

  const blocks = (scheduleQuery.data ?? []).sort((a, b) => a.day_of_week - b.day_of_week)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario del consultorio</CardTitle>
        <CardDescription>
          Horario general de atención. Los solapamientos se rechazan automáticamente (RF-CON04).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="clinic-day">Día</Label>
            <DayPicker id="clinic-day" value={day} onChange={setDay} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Rango horario</Label>
            <TimeRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
          </div>
          <Button type="submit" disabled={add.isPending} className="md:w-fit">
            {add.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Agregar
          </Button>
        </form>

        {scheduleQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : blocks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin horario definido. Agrega el primer bloque.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map((b: ClinicSchedule) => (
                <TableRow key={b.id}>
                  <TableCell>{dayLabel(b.day_of_week)}</TableCell>
                  <TableCell>
                    {timeLabel(b.start_time)} – {timeLabel(b.end_time)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(b.id)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

function ProfessionalScheduleSection({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const membersQuery = useTenantMembers(tenantId)
  const scheduleQuery = useProfessionalSchedules(tenantId)

  const [professionalId, setProfessionalId] = useState('')
  const [day, setDay] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [kind, setKind] = useState('WORK')
  const [importOpen, setImportOpen] = useState(false)

  const professionals = useMemo(() => {
    const clinical = (membersQuery.data ?? []).filter((m) =>
      ['professional', 'tenant_admin'].includes(m.role?.code ?? ''),
    )
    return clinical.sort((a, b) =>
      (a.user_profile?.full_name ?? '').localeCompare(b.user_profile?.full_name ?? ''),
    )
  }, [membersQuery.data])

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('professional_schedule').insert({
        tenant_id: tenantId,
        professional_id: professionalId,
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
        kind,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Bloque agregado al horario del profesional')
      queryClient.invalidateQueries({ queryKey: ['professional_schedule', tenantId] })
      setDay('')
      setStart('')
      setEnd('')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('professional_schedule').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Bloque eliminado')
      queryClient.invalidateQueries({ queryKey: ['professional_schedule', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (professionalId && day && start && end) {
      add.mutate()
    }
  }

  const rows = (scheduleQuery.data ?? [])
    .filter((s) => s.professional_id === professionalId)
    .sort((a, b) => a.day_of_week - b.day_of_week)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario por profesional</CardTitle>
        <CardDescription>
          Bloques de trabajo y descanso de cada psicólogo (RF-CON05, RF-CON06).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4 md:max-w-md">
          <div className="flex-1 space-y-2">
            <Label htmlFor="prof-select">Profesional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger id="prof-select" className="w-full">
                <SelectValue placeholder="Selecciona un profesional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.user_id}>
                    {p.user_profile?.full_name || p.user_profile?.email || p.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="shrink-0">
            <FileSpreadsheet className="mr-2 size-4" />
            Importar desde Excel
          </Button>
        </div>

        <ImportScheduleDialog
          tenantId={tenantId}
          open={importOpen}
          onOpenChange={setImportOpen}
          defaultProfessionalId={professionalId}
          professionals={professionals}
        />

        {professionalId && (
          <>
            <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-6">
              <div className="space-y-2">
                <Label htmlFor="prof-day">Día</Label>
                <DayPicker id="prof-day" value={day} onChange={setDay} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Rango horario</Label>
                <TimeRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prof-kind">Tipo</Label>
                <Select value={kind} onValueChange={setKind}>
                  <SelectTrigger id="prof-kind" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORK">Trabajo</SelectItem>
                    <SelectItem value="BREAK">Descanso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={add.isPending} className="md:w-fit">
                {add.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
                Agregar
              </Button>
            </form>

            {scheduleQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Sin bloques para este profesional.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Día</TableHead>
                    <TableHead>Horario</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s: ProfessionalSchedule) => (
                    <TableRow key={s.id}>
                      <TableCell>{dayLabel(s.day_of_week)}</TableCell>
                      <TableCell>
                        {timeLabel(s.start_time)} – {timeLabel(s.end_time)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={KIND_VARIANTS[s.kind]}>{KIND_LABELS[s.kind]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => remove.mutate(s.id)}>
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

const EXCEPTION_KINDS = ['BLOCKED', 'VACATION', 'HOLIDAY', 'OVERRIDE'] as const

function ExceptionsSection({ tenantId }: { tenantId: string }) {
  const queryClient = useQueryClient()
  const exceptionsQuery = useScheduleExceptions(tenantId)
  const membersQuery = useTenantMembers(tenantId)

  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [kind, setKind] = useState<string>('BLOCKED')
  const [professionalId, setProfessionalId] = useState('all')
  const [reason, setReason] = useState('')

  const professionals = useMemo(() => {
    const clinical = (membersQuery.data ?? []).filter((m) =>
      ['professional', 'tenant_admin'].includes(m.role?.code ?? ''),
    )
    return clinical.sort((a, b) =>
      (a.user_profile?.full_name ?? '').localeCompare(b.user_profile?.full_name ?? ''),
    )
  }, [membersQuery.data])

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('schedule_exception').insert({
        tenant_id: tenantId,
        professional_id: professionalId === 'all' ? null : professionalId,
        date,
        start_time: start,
        end_time: end,
        kind,
        reason: reason || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Excepción registrada')
      queryClient.invalidateQueries({ queryKey: ['schedule_exception', tenantId] })
      setDate('')
      setStart('')
      setEnd('')
      setReason('')
      setKind('BLOCKED')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('schedule_exception').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Excepción eliminada')
      queryClient.invalidateQueries({ queryKey: ['schedule_exception', tenantId] })
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (date && start && end) {
      add.mutate()
    }
  }

  const exceptions = exceptionsQuery.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Excepciones de agenda</CardTitle>
        <CardDescription>
          Bloqueos, vacaciones y feriados que anulan la disponibilidad (RF-CON07).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="exc-date">Fecha</Label>
            <Input
              id="exc-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Rango horario</Label>
            <TimeRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="exc-kind">Tipo</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger id="exc-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXCEPTION_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="exc-prof">Profesional</Label>
            <Select value={professionalId} onValueChange={setProfessionalId}>
              <SelectTrigger id="exc-prof" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todo el consultorio</SelectItem>
                {professionals.map((p) => (
                  <SelectItem key={p.id} value={p.user_id}>
                    {p.user_profile?.full_name || p.user_profile?.email || p.user_id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={add.isPending} className="md:w-fit">
            {add.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Agregar
          </Button>
          <div className="space-y-2 md:col-span-6">
            <Label htmlFor="exc-reason">Motivo</Label>
            <Input
              id="exc-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opcional"
            />
          </div>
        </form>

        {exceptionsQuery.isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : exceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin excepciones registradas.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Alcance</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exceptions.map((e: ScheduleException) => {
                const prof = professionals.find((p) => p.user_id === e.professional_id)
                return (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>
                      {timeLabel(e.start_time)} – {timeLabel(e.end_time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={KIND_VARIANTS[e.kind]}>{KIND_LABELS[e.kind]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {e.professional_id
                        ? prof?.user_profile?.full_name || 'Profesional'
                        : 'Todo el consultorio'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.reason || '—'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(e.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function HorariosTab({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-6">
      <ClinicScheduleSection tenantId={tenantId} />
      <ProfessionalScheduleSection tenantId={tenantId} />
      <ExceptionsSection tenantId={tenantId} />
    </div>
  )
}
