import { useState } from 'react'
import { CalendarClock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useRescheduleAppointment } from '@/features/citas/hooks/useAppointments'
import { useAvailability } from '@/features/citas/hooks/useAvailability'
import type { AppointmentRow } from '@/features/citas/hooks/useAppointments'
import { todayKey, formatTime } from '@/features/citas/utils'

export function RescheduleDialog({
  tenantId,
  appointment,
  open,
  onOpenChange,
}: {
  tenantId: string
  appointment: AppointmentRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const rescheduleMutation = useRescheduleAppointment(tenantId)
  const [date, setDate] = useState('')
  const [slotStart, setSlotStart] = useState('')

  const availability = useAvailability(
    tenantId,
    appointment?.professional_id ?? null,
    date || null,
    appointment?.service_id ?? null,
  )

  const handleSubmit = () => {
    if (!appointment || !slotStart) return
    rescheduleMutation.mutate(
      { appointmentId: appointment.id, scheduledAt: slotStart },
      {
        onSuccess: () => {
          toast.success('Cita reprogramada')
          onOpenChange(false)
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setDate('')
          setSlotStart('')
        }
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reprogramar cita</DialogTitle>
          <DialogDescription>
            {appointment
              ? `${appointment.patient?.first_name ?? ''} ${appointment.patient?.last_name ?? ''} · ${appointment.service?.name ?? 'Servicio'} · ${formatTime(appointment.scheduled_at)}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="resched-date">Nueva fecha</Label>
            <Input
              id="resched-date"
              type="date"
              value={date}
              min={todayKey()}
              onChange={(e) => {
                setDate(e.target.value)
                setSlotStart('')
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>Nuevo horario</Label>
            {!date ? (
              <p className="text-sm text-muted-foreground">Elige una fecha para ver los horarios disponibles.</p>
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
              <p className="text-sm text-muted-foreground">Sin disponibilidad para este día.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!slotStart || rescheduleMutation.isPending}
          >
            {rescheduleMutation.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <CalendarClock className="mr-2 size-4" />
            )}
            Confirmar reprogramación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
