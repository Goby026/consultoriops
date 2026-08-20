import { useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { useSaveRiskAlert, RISK_LEVEL_LABELS, type RiskLevel } from '@/features/sesiones/hooks/useRiskAlerts'

export function RiskAlertDialog({
  tenantId,
  patientId,
  patientName,
  professionalId,
  sessionId,
  open,
  onOpenChange,
}: {
  tenantId: string
  patientId: string
  patientName: string
  professionalId: string
  sessionId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saveMutation = useSaveRiskAlert(tenantId)

  const [level, setLevel] = useState<RiskLevel>('alta')
  const [description, setDescription] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    saveMutation.mutate(
      { patientId, sessionId, professionalId, level, description },
      {
        onSuccess: () => {
          toast.success('Alerta de riesgo registrada')
          setLevel('alta')
          setDescription('')
          onOpenChange(false)
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Alerta de riesgo</DialogTitle>
          <DialogDescription>
            {patientName} · Visible solo para el profesional y el administrador (RF27).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="ra-level">
              Nivel de riesgo <span className="text-destructive">*</span>
            </Label>
            <Select value={level} onValueChange={(v) => setLevel(v as RiskLevel)}>
              <SelectTrigger id="ra-level" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(RISK_LEVEL_LABELS) as RiskLevel[]).map((l) => (
                  <SelectItem key={l} value={l}>
                    {RISK_LEVEL_LABELS[l]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ra-description">Descripción</Label>
            <Textarea
              id="ra-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ideación suicida, autolesión activa, riesgo a terceros, motivo de la alerta…"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 size-4" />
              )}
              Registrar alerta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}