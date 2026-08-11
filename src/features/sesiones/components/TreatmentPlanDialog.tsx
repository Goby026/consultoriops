import { useState } from 'react'
import type { FormEvent } from 'react'
import { ClipboardPlus, Loader2, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useSaveTreatmentPlan,
  type TreatmentPlanStatus,
} from '@/features/sesiones/hooks/useTreatmentPlans'
import type { TreatmentPlan } from '@/lib/database.types'

const STATUS_LABELS: Record<TreatmentPlanStatus, string> = {
  active: 'Activo',
  completed: 'Completado',
  cancelled: 'Cancelado',
}

export function TreatmentPlanDialog({
  tenantId,
  patientId,
  patientName,
  professionalId,
  initial,
  open,
  onOpenChange,
}: {
  tenantId: string
  patientId: string
  patientName: string
  professionalId: string
  initial: TreatmentPlan | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saveMutation = useSaveTreatmentPlan(tenantId)

  const [objectives, setObjectives] = useState(initial?.objectives ?? '')
  const [suggestedFrequency, setSuggestedFrequency] = useState(initial?.suggested_frequency ?? '')
  const [durationWeeks, setDurationWeeks] = useState(
    initial?.duration_weeks != null ? String(initial.duration_weeks) : '',
  )
  const [startsOn, setStartsOn] = useState(initial?.starts_on ?? todayKey())
  const [endsOn, setEndsOn] = useState(initial?.ends_on ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [status, setStatus] = useState<TreatmentPlanStatus>(
    (initial?.status as TreatmentPlanStatus) ?? 'active',
  )

  const ready = objectives.trim().length > 0 && startsOn.length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    saveMutation.mutate(
      {
        id: initial?.id,
        values: {
          patientId,
          professionalId,
          objectives,
          suggestedFrequency,
          durationWeeks: durationWeeks.trim() ? Number(durationWeeks) : null,
          startsOn,
          endsOn,
          notes,
        },
      },
      {
        onSuccess: () => {
          toast.success(initial ? 'Plan de tratamiento actualizado' : 'Plan de tratamiento creado')
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
          <DialogTitle>{initial ? 'Editar plan de tratamiento' : 'Nuevo plan de tratamiento'}</DialogTitle>
          <DialogDescription>
            {patientName} · Objetivos terapéuticos medibles y frecuencia sugerida (RF23).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="tp-objectives">
              Objetivos terapéuticos <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="tp-objectives"
              value={objectives}
              onChange={(e) => setObjectives(e.target.value)}
              rows={4}
              placeholder={'Escribe un objetivo medible por línea.\nEj.: Reducir la frecuencia de episodios de ansiedad de 4 a 1 por semana.'}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="tp-frequency">Frecuencia sugerida</Label>
              <Input
                id="tp-frequency"
                value={suggestedFrequency}
                onChange={(e) => setSuggestedFrequency(e.target.value)}
                placeholder="ej. 2 veces por semana"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-duration">Duración (semanas)</Label>
              <Input
                id="tp-duration"
                type="number"
                min={1}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(e.target.value)}
                placeholder="ej. 8"
              />
            </div>
            {initial ? (
              <div className="space-y-2">
                <Label htmlFor="tp-status">Estado</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TreatmentPlanStatus)}>
                  <SelectTrigger id="tp-status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(STATUS_LABELS) as TreatmentPlanStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Estado</Label>
                <div className="pt-2 text-sm text-muted-foreground">Activo</div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tp-start">
                Fecha de inicio <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tp-start"
                type="date"
                value={startsOn}
                onChange={(e) => setStartsOn(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tp-end">Fin estimado</Label>
              <Input
                id="tp-end"
                type="date"
                value={endsOn}
                onChange={(e) => setEndsOn(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tp-notes">Notas</Label>
            <Textarea
              id="tp-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Observaciones, pautas, estrategias…"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!ready || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : initial ? (
                <Target className="mr-2 size-4" />
              ) : (
                <ClipboardPlus className="mr-2 size-4" />
              )}
              {initial ? 'Guardar cambios' : 'Crear plan de tratamiento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
