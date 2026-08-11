import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePatients } from '@/features/pacientes/hooks/usePatients'
import { useServices } from '@/features/configuracion/hooks/useServices'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import { useCreateAppointment } from '@/features/citas/hooks/useAppointments'
import { useAvailability } from '@/features/citas/hooks/useAvailability'
import { todayKey, formatTime } from '@/features/citas/utils'

export function AppointmentFormDialog({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const patientsQuery = usePatients(tenantId)
  const membersQuery = useTenantMembers(tenantId)
  const servicesQuery = useServices(tenantId)
  const createMutation = useCreateAppointment(tenantId)

  const [patientId, setPatientId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(todayKey())
  const [slotStart, setSlotStart] = useState('')
  const [notes, setNotes] = useState('')

  const professionals = useMemo(
    () =>
      (membersQuery.data ?? []).filter(
        (m) => m.role?.code === 'professional' || m.role?.code === 'tenant_admin',
      ),
    [membersQuery.data],
  )

  const availability = useAvailability(
    tenantId,
    professionalId || null,
    date || null,
    serviceId || null,
  )

  const ready =
    Boolean(patientId && professionalId && serviceId && date && slotStart)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    createMutation.mutate(
      { patientId, professionalId, serviceId, scheduledAt: slotStart, notes },
      {
        onSuccess: () => {
          toast.success('Cita registrada')
          setPatientId('')
          setProfessionalId('')
          setServiceId('')
          setSlotStart('')
          setNotes('')
          onOpenChange(false)
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nueva cita</DialogTitle>
          <DialogDescription>Registra una cita respetando la disponibilidad del profesional (RF14).</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="appt-patient">Paciente</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger id="appt-patient">
                  <SelectValue placeholder="Seleccionar paciente" />
                </SelectTrigger>
                <SelectContent>
                  {patientsQuery.data?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                      {p.medical_record_number ? ` · ${p.medical_record_number}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appt-professional">Profesional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger id="appt-professional">
                  <SelectValue placeholder="Seleccionar profesional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.user_profile?.full_name || m.user_profile?.email || 'Profesional'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appt-service">Servicio</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger id="appt-service">
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {servicesQuery.data?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appt-date">Fecha</Label>
              <Input
                id="appt-date"
                type="date"
                value={date}
                min={todayKey()}
                onChange={(e) => {
                  setDate(e.target.value)
                  setSlotStart('')
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Horario disponible</Label>
            {!professionalId || !serviceId || !date ? (
              <p className="text-sm text-muted-foreground">
                Selecciona profesional, servicio y fecha para ver los horarios disponibles.
              </p>
            ) : availability.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Consultando disponibilidad…
              </div>
            ) : availability.isError ? (
              <p className="text-sm text-destructive">No se pudo consultar la disponibilidad.</p>
            ) : availability.data && availability.data.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {availability.data.map((slot) => (
                  <button
                    key={slot.slot_start}
                    type="button"
                    onClick={() => setSlotStart(slot.slot_start)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      slotStart === slot.slot_start
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input hover:bg-accent'
                    }`}
                  >
                    {formatTime(slot.slot_start)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin disponibilidad para este día. Configura el horario del profesional.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="appt-notes">Notas (opcional)</Label>
            <Textarea
              id="appt-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!ready || createMutation.isPending}>
              {createMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <CalendarPlus className="mr-2 size-4" />
              )}
              Registrar cita
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
