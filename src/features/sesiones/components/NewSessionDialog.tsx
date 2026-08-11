import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { ClipboardPlus, Loader2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  useCreateSession,
  usePendingSessionAppointments,
  useSaveAnamnesis,
  useSaveProgressNote,
} from '@/features/sesiones/hooks/useSessions'
import { formatDateTime } from '@/features/sesiones/utils'

export function NewSessionDialog({
  tenantId,
  open,
  onOpenChange,
}: {
  tenantId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const pendingQuery = usePendingSessionAppointments(tenantId)
  const createSessionMutation = useCreateSession(tenantId)
  const saveAnamnesisMutation = useSaveAnamnesis(tenantId)
  const saveNoteMutation = useSaveProgressNote(tenantId)

  const [appointmentId, setAppointmentId] = useState('')
  const [reason, setReason] = useState('')
  const [personal, setPersonal] = useState('')
  const [family, setFamily] = useState('')
  const [history, setHistory] = useState('')
  const [risk, setRisk] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [plan, setPlan] = useState('')

  const pending = useMemo(() => pendingQuery.data ?? [], [pendingQuery.data])
  const appointment = pending.find((a) => a.id === appointmentId)

  const ready =
    Boolean(appointmentId) &&
    reason.trim().length > 0 &&
    subjective.trim().length > 0 &&
    objective.trim().length > 0 &&
    analysis.trim().length > 0 &&
    plan.trim().length > 0

  const busy =
    createSessionMutation.isPending ||
    saveAnamnesisMutation.isPending ||
    saveNoteMutation.isPending

  const reset = () => {
    setAppointmentId('')
    setReason('')
    setPersonal('')
    setFamily('')
    setHistory('')
    setRisk('')
    setSubjective('')
    setObjective('')
    setAnalysis('')
    setPlan('')
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!ready || !appointment) return

    createSessionMutation.mutate(appointment.id, {
      onSuccess: (session) => {
        saveAnamnesisMutation.mutate(
          {
            sessionId: session.id,
            patientId: session.patient_id,
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
              saveNoteMutation.mutate(
                {
                  sessionId: session.id,
                  patientId: session.patient_id,
                  values: { subjective, objective, analysis, plan },
                },
                {
                  onSuccess: () => {
                    toast.success('Sesión clínica registrada')
                    reset()
                    onOpenChange(false)
                  },
                  onError: (error: Error) => toast.error(error.message),
                },
              )
            },
            onError: (error: Error) => toast.error(error.message),
          },
        )
      },
      onError: (error: Error) => toast.error(error.message),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nueva sesión clínica</DialogTitle>
          <DialogDescription>
            Registra la sesión de una cita atendida (RF19) con anamnesis (RF20) y nota SOAP (RF21).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="ses-appointment">Cita atendida</Label>
            <Select value={appointmentId} onValueChange={setAppointmentId}>
              <SelectTrigger id="ses-appointment">
                <SelectValue placeholder="Seleccionar cita" />
              </SelectTrigger>
              <SelectContent>
                {pending.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.patient_first_name} {a.patient_last_name} · {a.service_name} ·{' '}
                    {formatDateTime(a.scheduled_at)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {pendingQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">Consultando citas atendidas…</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hay citas ATENDIDA pendientes de sesión.
              </p>
            ) : null}
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Anamnesis (RF20)</h3>
            <div className="space-y-2">
              <Label htmlFor="ses-reason">
                Motivo de consulta <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="ses-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ses-personal">Antecedentes personales</Label>
                <Textarea
                  id="ses-personal"
                  value={personal}
                  onChange={(e) => setPersonal(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ses-family">Antecedentes familiares</Label>
                <Textarea
                  id="ses-family"
                  value={family}
                  onChange={(e) => setFamily(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ses-history">Historia del problema actual</Label>
              <Textarea
                id="ses-history"
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ses-risk">Evaluación de factores de riesgo</Label>
              <Textarea
                id="ses-risk"
                value={risk}
                onChange={(e) => setRisk(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-md border p-4">
            <h3 className="text-sm font-medium">Nota de evolución SOAP (RF21)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ses-s">
                  Subjetivo <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ses-s"
                  value={subjective}
                  onChange={(e) => setSubjective(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ses-o">
                  Objetivo <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ses-o"
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ses-a">
                  Análisis <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ses-a"
                  value={analysis}
                  onChange={(e) => setAnalysis(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ses-p">
                  Plan <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="ses-p"
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!ready || busy}>
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ClipboardPlus className="mr-2 size-4" />}
              Registrar sesión
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
