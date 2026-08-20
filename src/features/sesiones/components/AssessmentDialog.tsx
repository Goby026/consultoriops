import { useState } from 'react'
import type { FormEvent } from 'react'
import { Activity, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
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
import { useSaveAssessmentResult } from '@/features/sesiones/hooks/useAssessmentResults'
import {
  getScale,
  severityVariant,
  ASSESSMENT_SCALES,
  type AssessmentScaleCode,
} from '@/features/sesiones/constants/assessmentScales'

const ANSWER_LABELS = ['0 · En absoluto', '1 · Varios días', '2 · Más de la mitad de los días', '3 · Casi todos los días']

export function AssessmentDialog({
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
  sessionId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const saveMutation = useSaveAssessmentResult(tenantId)

  const [scaleCode, setScaleCode] = useState<AssessmentScaleCode>('PHQ-9')
  const [answers, setAnswers] = useState<number[]>(() =>
    Array(getScale('PHQ-9').questions.length).fill(0),
  )
  const [notes, setNotes] = useState('')
  const [assessedOn, setAssessedOn] = useState(todayKey())

  const scale = getScale(scaleCode)
  const total = answers.reduce((acc, n) => acc + n, 0)
  const severity = scale.severityFor(total)

  const handleScaleChange = (value: string) => {
    const next = value as AssessmentScaleCode
    setScaleCode(next)
    setAnswers(Array(getScale(next).questions.length).fill(0))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!assessedOn) return
    saveMutation.mutate(
      {
        values: {
          patientId,
          professionalId,
          sessionId,
          scaleCode,
          totalScore: total,
          severity,
          notes,
          assessedOn,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Resultado ${scaleCode} registrado`)
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
          <DialogTitle>Registrar escala de evaluación</DialogTitle>
          <DialogDescription>
            {patientName} · Cuestionario estandarizado y evolución temporal (RF24).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="as-scale">
                Escala <span className="text-destructive">*</span>
              </Label>
              <Select value={scaleCode} onValueChange={handleScaleChange}>
                <SelectTrigger id="as-scale" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSESSMENT_SCALES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>
                      {s.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="as-date">
                Fecha de aplicación <span className="text-destructive">*</span>
              </Label>
              <Input
                id="as-date"
                type="date"
                value={assessedOn}
                onChange={(e) => setAssessedOn(e.target.value)}
                required
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{scale.instructions}</p>

          <div className="space-y-3">
            {scale.questions.map((question, i) => (
              <div key={`${scaleCode}-${i}`} className="grid gap-2 sm:grid-cols-2 sm:items-center">
                <p className="text-sm">
                  <span className="mr-1 text-xs text-muted-foreground">{i + 1}.</span>
                  {question}
                </p>
                <Select
                  value={String(answers[i])}
                  onValueChange={(v) =>
                    setAnswers((prev) => prev.map((a, idx) => (idx === i ? Number(v) : a)))
                  }
                >
                  <SelectTrigger className="w-full" aria-label={`Pregunta ${i + 1}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANSWER_LABELS.map((label, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-md border px-3 py-2">
            <span className="text-sm text-muted-foreground">
              Total: <span className="font-medium text-foreground">{total}</span> /{' '}
              {scale.questions.length * 3}
            </span>
            <Badge variant={severityVariant(severity)}>{severity}</Badge>
          </div>

          <div className="space-y-2">
            <Label htmlFor="as-notes">Notas</Label>
            <Textarea
              id="as-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Interpretación, contexto, observaciones…"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!assessedOn || saveMutation.isPending}>
              {saveMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Activity className="mr-2 size-4" />
              )}
              Registrar resultado
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