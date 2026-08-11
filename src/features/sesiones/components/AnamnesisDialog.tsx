import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2, Stethoscope } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { useSaveAnamnesis } from '@/features/sesiones/hooks/useSessions'
import type { Anamnesis } from '@/lib/database.types'

export function AnamnesisDialog({
  tenantId,
  sessionId,
  patientId,
  initial,
  open,
  onOpenChange,
}: {
  tenantId: string
  sessionId: string
  patientId: string
  initial: Anamnesis | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saveMutation = useSaveAnamnesis(tenantId)

  const [reason, setReason] = useState('')
  const [personal, setPersonal] = useState('')
  const [family, setFamily] = useState('')
  const [history, setHistory] = useState('')
  const [risk, setRisk] = useState('')

  useEffect(() => {
    if (open) {
      setReason(initial?.reason_for_consultation ?? '')
      setPersonal(initial?.personal_background ?? '')
      setFamily(initial?.family_background ?? '')
      setHistory(initial?.problem_history ?? '')
      setRisk(initial?.risk_assessment ?? '')
    }
  }, [open, initial])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    saveMutation.mutate(
      {
        sessionId,
        patientId,
        values: {
          reason_for_consultation: reason,
          personal_background: personal,
          family_background: family,
          problem_history: history,
          risk_assessment: risk,
        },
      },
      {
        onSuccess: () => {
          toast.success('Anamnesis guardada')
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
          <DialogTitle>Anamnesis (RF20)</DialogTitle>
          <DialogDescription>
            {initial ? 'Edita la anamnesis de la sesión.' : 'Registra la anamnesis estructurada de la sesión.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="an-reason">
              Motivo de consulta <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="an-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="an-personal">Antecedentes personales</Label>
              <Textarea
                id="an-personal"
                value={personal}
                onChange={(e) => setPersonal(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="an-family">Antecedentes familiares</Label>
              <Textarea
                id="an-family"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="an-history">Historia del problema actual</Label>
            <Textarea
              id="an-history"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="an-risk">Evaluación de factores de riesgo</Label>
            <Textarea
              id="an-risk"
              value={risk}
              onChange={(e) => setRisk(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!reason.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Stethoscope className="mr-2 size-4" />
              )}
              Guardar anamnesis
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
