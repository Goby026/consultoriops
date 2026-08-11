import { useState } from 'react'
import type { FormEvent } from 'react'
import { FileText, Loader2 } from 'lucide-react'
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
import { useSaveProgressNote } from '@/features/sesiones/hooks/useSessions'

export function SoapNoteDialog({
  tenantId,
  sessionId,
  patientId,
  open,
  onOpenChange,
}: {
  tenantId: string
  sessionId: string
  patientId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saveMutation = useSaveProgressNote(tenantId)

  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [plan, setPlan] = useState('')

  const ready =
    subjective.trim().length > 0 &&
    objective.trim().length > 0 &&
    analysis.trim().length > 0 &&
    plan.trim().length > 0

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready) return
    saveMutation.mutate(
      { sessionId, patientId, values: { subjective, objective, analysis, plan } },
      {
        onSuccess: () => {
          toast.success('Nota SOAP añadida')
          setSubjective('')
          setObjective('')
          setAnalysis('')
          setPlan('')
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
          <DialogTitle>Nota de evolución SOAP (RF21)</DialogTitle>
          <DialogDescription>
            Añade una nota de evolución a la sesión (Subjetivo, Objetivo, Análisis, Plan).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="so-s">
              Subjetivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="so-s"
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-o">
              Objetivo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="so-o"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-a">
              Análisis <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="so-a"
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="so-p">
              Plan <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="so-p"
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!ready || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <FileText className="mr-2 size-4" />
              )}
              Guardar nota SOAP
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
