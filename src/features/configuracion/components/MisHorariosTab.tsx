import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
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
import { useProfessionalSchedules, useScheduleExceptions } from '@/features/configuracion/hooks/useSchedules'
import { dayLabel } from './dayLabels'
import type { ProfessionalSchedule } from '@/lib/database.types'

const KIND_LABELS: Record<string, string> = {
  WORK: 'Trabajo',
  BREAK: 'Descanso',
}

const KIND_VARIANTS: Record<string, 'secondary' | 'outline'> = {
  WORK: 'secondary',
  BREAK: 'outline',
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

export function MisHorariosTab({ tenantId, userId }: { tenantId: string; userId: string }) {
  const queryClient = useQueryClient()
  const scheduleQuery = useProfessionalSchedules(tenantId)
  const exceptionsQuery = useScheduleExceptions(tenantId)

  const [day, setDay] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [kind, setKind] = useState('WORK')

  const myBlocks = useMemo(
    () =>
      (scheduleQuery.data ?? [])
        .filter((s) => s.professional_id === userId)
        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time)),
    [scheduleQuery.data, userId],
  )

  const myExceptions = useMemo(
    () =>
      (exceptionsQuery.data ?? [])
        .filter((e) => !e.professional_id || e.professional_id === userId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [exceptionsQuery.data, userId],
  )

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('professional_schedule').insert({
        tenant_id: tenantId,
        professional_id: userId,
        day_of_week: Number(day),
        start_time: start,
        end_time: end,
        kind,
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast.success('Bloque agregado a tu horario')
      queryClient.invalidateQueries({ queryKey: ['professional_schedule', tenantId] })
      setDay('')
      setStart('')
      setEnd('')
    },
    onError: (error: Error) => toast.error(error.message),
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
    onError: (error: Error) => toast.error(error.message),
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (day && start && end) add.mutate()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Mis horarios</CardTitle>
          <CardDescription>
            Bloques de trabajo y descanso que definen tu disponibilidad para citas. Los
            solapamientos se rechazan automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="grid items-end gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="my-day">Día</Label>
              <DayPicker id="my-day" value={day} onChange={setDay} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Rango horario</Label>
              <TimeRange start={start} end={end} onStart={setStart} onEnd={setEnd} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="my-kind">Tipo</Label>
              <Select value={kind} onValueChange={setKind}>
                <SelectTrigger id="my-kind" className="w-full">
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
          ) : myBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes bloques definidos. Agrega tu primer bloque de trabajo.
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
                {myBlocks.map((s: ProfessionalSchedule) => (
                  <TableRow key={s.id}>
                    <TableCell>{dayLabel(s.day_of_week)}</TableCell>
                    <TableCell>
                      {timeLabel(s.start_time)} – {timeLabel(s.end_time)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={KIND_VARIANTS[s.kind] ?? 'outline'}>
                        {KIND_LABELS[s.kind] ?? s.kind}
                      </Badge>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Excepciones que afectan mi agenda</CardTitle>
          <CardDescription>
            Bloqueos, vacaciones y feriados que anulan tu disponibilidad (solo lectura).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exceptionsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : myExceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin excepciones para ti.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myExceptions.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{e.date}</TableCell>
                    <TableCell>
                      {timeLabel(e.start_time)} – {timeLabel(e.end_time)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.reason || '—'}</TableCell>
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
