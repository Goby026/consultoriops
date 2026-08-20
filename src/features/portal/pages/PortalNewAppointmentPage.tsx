import { useState } from 'react'
import type { FormEvent } from 'react'
import { CalendarPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useSession } from '@/features/auth/hooks/useSession'
import { useServices } from '@/features/configuracion/hooks/useServices'
import { useAvailability } from '@/features/citas/hooks/useAvailability'
import {
  useCreatePortalAppointment,
  usePortalFicha,
  usePortalProfessionals,
} from '@/features/portal/hooks/usePortal'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function PortalNewAppointmentPage() {
  const { activeTenantId } = useActiveTenant()
  const { session } = useSession()
  const fichaQuery = usePortalFicha(activeTenantId, session?.user.id)
  const servicesQuery = useServices(activeTenantId)
  const professionalsQuery = usePortalProfessionals(activeTenantId)

  const [serviceId, setServiceId] = useState('')
  const [professionalId, setProfessionalId] = useState('')
  const [date, setDate] = useState('')
  const [slotStart, setSlotStart] = useState('')

  const activeServices = (servicesQuery.data ?? []).filter((s) => s.active)
  const availability = useAvailability(activeTenantId, professionalId || null, date || null, serviceId || null)
  const createMutation = useCreatePortalAppointment(activeTenantId)

  const ready = Boolean(fichaQuery.data?.id && serviceId && professionalId && date && slotStart)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready || !fichaQuery.data?.id) return
    createMutation.mutate(
      {
        fichaId: fichaQuery.data.id,
        professionalId,
        serviceId,
        scheduledAt: slotStart,
      },
      {
        onSuccess: () => {
          toast.success('Cita solicitada y confirmada')
          setServiceId('')
          setProfessionalId('')
          setDate('')
          setSlotStart('')
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  const isLoading = servicesQuery.isLoading || professionalsQuery.isLoading || fichaQuery.isLoading

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Solicitar cita</CardTitle>
        <CardDescription>
          Elige un servicio, profesional, día y horario. Tu cita queda confirmada automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="np-service">Servicio</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger id="np-service">
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {activeServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="np-professional">Profesional</Label>
              <Select value={professionalId} onValueChange={setProfessionalId}>
                <SelectTrigger id="np-professional">
                  <SelectValue placeholder="Seleccionar profesional" />
                </SelectTrigger>
                <SelectContent>
                  {(professionalsQuery.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="np-date">Día</Label>
            <Input
              id="np-date"
              type="date"
              min={todayKey()}
              value={date}
              onChange={(e) => {
                setDate(e.target.value)
                setSlotStart('')
              }}
            />
          </div>

          {availability.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Buscando horarios…
            </div>
          ) : availability.data && availability.data.length > 0 ? (
            <div className="space-y-2">
              <Label>Horarios disponibles</Label>
              <div className="flex flex-wrap gap-2">
                {availability.data.map((slot) => {
                  const selected = slot.slot_start === slotStart
                  return (
                    <button
                      key={slot.slot_start}
                      type="button"
                      onClick={() => setSlotStart(slot.slot_start)}
                      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {new Date(slot.slot_start).toLocaleTimeString('es-PE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : date ? (
            <div className="text-sm text-muted-foreground">
              No hay horarios disponibles para esa combinación. Prueba otro día o profesional.
            </div>
          ) : null}

          <div className="flex items-center justify-between">
            {ready && (
              <Badge variant="secondary">Se confirmará como cita programada</Badge>
            )}
            <Button type="submit" disabled={!ready || createMutation.isPending} className="ml-auto">
              {createMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              <CalendarPlus className="mr-2 size-4" />
              Solicitar cita
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}