import { useState } from 'react'
import type { FormEvent } from 'react'
import { ClipboardPlus, Loader2, Stethoscope } from 'lucide-react'
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
import { useSaveDiagnosis } from '@/features/sesiones/hooks/useDiagnoses'
import { ICD11_SUGGESTIONS } from '@/features/sesiones/constants/assessmentScales'
import type { Diagnosis } from '@/lib/database.types'

export function DiagnosisDialog({
  tenantId,
  patientId,
  patientName,
  professionalId,
  sessionId,
  initial,
  open,
  onOpenChange,
}: {
  tenantId: string
  patientId: string
  patientName: string
  professionalId: string
  sessionId?: string | null
  initial: Diagnosis | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saveMutation = useSaveDiagnosis(tenantId)

  const [icd11Code, setIcd11Code] = useState(initial?.icd11_code ?? '')
  const [icd11Label, setIcd11Label] = useState(initial?.icd11_label ?? '')
  const [isPrimary, setIsPrimary] = useState(initial?.is_primary ?? false)
  const [description, setDescription] = useState(initial?.description ?? '')

  const ready = icd11Code.trim().length > 0 && icd11Label.trim().length > 0

  const handleCodeChange = (value: string) => {
    setIcd11Code(value)
    const match = ICD11_SUGGESTIONS.find(
      (s) => s.code.toLowerCase() === value.trim().toLowerCase(),
    )
    if (match && !icd11Label.trim()) setIcd11Label(match.label)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    saveMutation.mutate(
      {
        id: initial?.id,
        values: {
          patientId,
          professionalId,
          sessionId,
          icd11Code,
          icd11Label,
          isPrimary,
          description,
        },
      },
      {
        onSuccess: () => {
          toast.success(initial ? 'Diagnóstico actualizado' : 'Diagnóstico registrado')
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
          <DialogTitle>{initial ? 'Editar diagnóstico' : 'Nuevo diagnóstico'}</DialogTitle>
          <DialogDescription>
            {patientName} · Código estandarizado CIE-11 y descripción libre (RF22).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dx-code">
                Código CIE-11 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dx-code"
                value={icd11Code}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="ej. 6A71"
                list="icd11-suggestions"
              />
              <datalist id="icd11-suggestions">
                {ICD11_SUGGESTIONS.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dx-label">
                Nombre del diagnóstico <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dx-label"
                value={icd11Label}
                onChange={(e) => setIcd11Label(e.target.value)}
                placeholder="ej. Trastorno depresivo"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <input
              id="dx-primary"
              type="checkbox"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="size-4"
            />
            <Label htmlFor="dx-primary" className="cursor-pointer">
              Diagnóstico principal
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dx-description">Descripción</Label>
            <Textarea
              id="dx-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Observaciones, especificaciones clínicas…"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!ready || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : initial ? (
                <Stethoscope className="mr-2 size-4" />
              ) : (
                <ClipboardPlus className="mr-2 size-4" />
              )}
              {initial ? 'Guardar cambios' : 'Registrar diagnóstico'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}