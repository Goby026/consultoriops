import { useMemo, useState } from 'react'
import { Activity, ClipboardPlus, ClipboardList, FilePlus2, FileText, ListChecks, Loader2, PenLine, ShieldAlert, Stethoscope, Target } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import { useSession } from '@/features/auth/hooks/useSession'
import { useSessions, useSignProgressNote } from '@/features/sesiones/hooks/useSessions'
import type { SessionRow } from '@/features/sesiones/hooks/useSessions'
import { useRiskAlerts, RISK_LEVEL_LABELS, RISK_LEVEL_VARIANT } from '@/features/sesiones/hooks/useRiskAlerts'
import {
  useTreatmentPlans,
  useUpdateTreatmentPlanStatus,
  type TreatmentPlanRow,
  type TreatmentPlanStatus,
} from '@/features/sesiones/hooks/useTreatmentPlans'
import { useDiagnoses, type DiagnosisRow } from '@/features/sesiones/hooks/useDiagnoses'
import { useAssessmentResults } from '@/features/sesiones/hooks/useAssessmentResults'
import type { ProgressNote } from '@/lib/database.types'
import { NewSessionDialog } from './NewSessionDialog'
import { AnamnesisDialog } from './AnamnesisDialog'
import { SoapNoteDialog } from './SoapNoteDialog'
import { TreatmentPlanDialog } from './TreatmentPlanDialog'
import { DiagnosisDialog } from './DiagnosisDialog'
import { AssessmentDialog } from './AssessmentDialog'
import { RiskAlertDialog } from './RiskAlertDialog'
import { SCALE_LABELS, severityVariant, type AssessmentScaleCode } from '@/features/sesiones/constants/assessmentScales'
import { formatDateTime } from '@/features/sesiones/utils'

const statusMeta: Record<string, { label: string; variant: 'secondary' | 'outline' }> = {
  open: { label: 'Abierta', variant: 'secondary' },
  completed: { label: 'Completada', variant: 'outline' },
}

const planStatusMeta: Record<TreatmentPlanStatus, { label: string; variant: 'secondary' | 'outline' | 'destructive' }> = {
  active: { label: 'Activo', variant: 'secondary' },
  completed: { label: 'Completado', variant: 'outline' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
}

export function SesionesPage() {
  const { activeTenantId } = useActiveTenant()
  const { session } = useSession()
  const sessionsQuery = useSessions(activeTenantId)
  const membersQuery = useTenantMembers(activeTenantId)
  const treatmentPlansQuery = useTreatmentPlans(activeTenantId)
  const diagnosesQuery = useDiagnoses(activeTenantId)
  const assessmentsQuery = useAssessmentResults(activeTenantId)
  const riskAlertsQuery = useRiskAlerts(activeTenantId)
  const planStatusMutation = useUpdateTreatmentPlanStatus(activeTenantId ?? '')
  const signNoteMutation = useSignProgressNote(activeTenantId ?? '')

  const [newOpen, setNewOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [anamnesisFor, setAnamnesisFor] = useState<SessionRow | null>(null)
  const [soapFor, setSoapFor] = useState<SessionRow | null>(null)
  const [addendumFor, setAddendumFor] = useState<ProgressNote | null>(null)
  const [signConfirmFor, setSignConfirmFor] = useState<ProgressNote | null>(null)
  const [planFor, setPlanFor] = useState<TreatmentPlanRow | null>(null)
  const [planOpen, setPlanOpen] = useState(false)
  const [diagnosisFor, setDiagnosisFor] = useState<DiagnosisRow | null>(null)
  const [diagnosisOpen, setDiagnosisOpen] = useState(false)
  const [assessmentOpen, setAssessmentOpen] = useState(false)
  const [riskOpen, setRiskOpen] = useState(false)

  const isProfessional = useMemo(() => {
    if (!activeTenantId || !session?.user.id) return false
    return (membersQuery.data ?? []).some(
      (m) =>
        m.user_id === session.user.id &&
        m.status === 'active' &&
        m.role?.code === 'professional',
    )
  }, [membersQuery.data, activeTenantId, session?.user.id])

  const professionalName = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of membersQuery.data ?? []) {
      map.set(m.user_id, m.user_profile?.full_name || m.user_profile?.email || 'Profesional')
    }
    return map
  }, [membersQuery.data])
  const professionalNameOf = (userId: string) => professionalName.get(userId) ?? 'Profesional'

  const selected = useMemo(
    () => sessionsQuery.data?.find((s) => s.id === selectedId) ?? null,
    [sessionsQuery.data, selectedId],
  )
  const anamnesis = selected?.anamnesis?.[0] ?? null
  const notes = selected?.progress_note ?? []
  const rootNotes = notes.filter((n) => !n.addendum_of)
  const addendaByNote = new Map<string, ProgressNote[]>()
  for (const n of notes) {
    if (!n.addendum_of) continue
    const list = addendaByNote.get(n.addendum_of) ?? []
    list.push(n)
    addendaByNote.set(n.addendum_of, list)
  }
  const sessionAlerts = useMemo(
    () =>
      selected
        ? (riskAlertsQuery.data ?? []).filter((a) => a.session_id === selected.id)
        : [],
    [riskAlertsQuery.data, selected],
  )
  const patientPlans = useMemo(
    () =>
      selected
        ? (treatmentPlansQuery.data ?? []).filter((p) => p.patient_id === selected.patient_id)
        : [],
    [treatmentPlansQuery.data, selected],
  )
  const patientDiagnoses = useMemo(
    () =>
      selected
        ? (diagnosesQuery.data ?? []).filter((d) => d.patient_id === selected.patient_id)
        : [],
    [diagnosesQuery.data, selected],
  )
  const patientAssessments = useMemo(
    () =>
      selected
        ? (assessmentsQuery.data ?? []).filter((a) => a.patient_id === selected.patient_id)
        : [],
    [assessmentsQuery.data, selected],
  )

  const changePlanStatus = (plan: TreatmentPlanRow, status: TreatmentPlanStatus) => {
    planStatusMutation.mutate(
      { id: plan.id, status },
      {
        onSuccess: () =>
          toast.success(`Plan marcado como ${planStatusMeta[status].label.toLowerCase()}`),
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  const signNote = (note: ProgressNote) => {
    if (!session?.user.id) return
    signNoteMutation.mutate(
      { id: note.id, userId: session.user.id },
      {
        onSuccess: () => toast.success('Nota firmada (inmutable)'),
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  if (!activeTenantId) {
    return <p className="text-muted-foreground">Selecciona un consultorio para ver sus sesiones.</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sesiones clínicas</h1>
          <p className="text-muted-foreground">
            Registro de sesiones, anamnesis y notas de evolución (RF19–RF21).
          </p>
        </div>
        {isProfessional && (
          <Button onClick={() => setNewOpen(true)}>
            <ClipboardPlus className="mr-2 size-4" />
            Nueva sesión
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Historial de sesiones</CardTitle>
          <CardDescription>
            Solo profesionales y administradores acceden a datos clínicos (RN06, RN13).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sessionsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : (sessionsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay sesiones registradas. Marca una cita como atendida para poder abrir una sesión.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Profesional</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Notas</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sessionsQuery.data ?? []).map((s) => {
                  const meta = statusMeta[s.status] ?? statusMeta.open
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{formatDateTime(s.started_at)}</TableCell>
                      <TableCell>
                        {s.patient?.first_name} {s.patient?.last_name}
                        {s.patient?.medical_record_number && (
                          <div className="text-xs text-muted-foreground">
                            {s.patient.medical_record_number}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.appointment?.service?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {professionalNameOf(s.professional_id)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.progress_note?.length ?? 0}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ver detalle"
                            onClick={() => setSelectedId(selectedId === s.id ? null : s.id)}
                          >
                            <ClipboardList className="mr-1 size-4" />
                            {selectedId === s.id ? 'Ocultar' : 'Ver'}
                          </Button>
                          {isProfessional && s.professional_id === session?.user.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Anamnesis"
                                onClick={() => setAnamnesisFor(s)}
                              >
                                <Stethoscope className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Nota SOAP"
                                onClick={() => setSoapFor(s)}
                              >
                                <FileText className="size-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>
              {selected.patient?.first_name} {selected.patient?.last_name} ·{' '}
              {formatDateTime(selected.started_at)}
            </CardTitle>
            <CardDescription>
              Detalle clínico de la sesión (acceso exclusivo profesional dueño y administrador).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Anamnesis</h3>
                {isProfessional && selected.professional_id === session?.user.id && (
                  <Button variant="outline" size="sm" onClick={() => setAnamnesisFor(selected)}>
                    <Stethoscope className="mr-2 size-4" />
                    {anamnesis ? 'Editar' : 'Registrar'}
                  </Button>
                )}
              </div>
              {anamnesis ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <Field label="Motivo de consulta" value={anamnesis.reason_for_consultation} wide />
                  <Field label="Antecedentes personales" value={anamnesis.personal_background} />
                  <Field label="Antecedentes familiares" value={anamnesis.family_background} />
                  <Field label="Historia del problema actual" value={anamnesis.problem_history} />
                  <Field label="Evaluación de factores de riesgo" value={anamnesis.risk_assessment} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Anamnesis no registrada.</p>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Notas de evolución SOAP</h3>
                {isProfessional && selected.professional_id === session?.user.id && (
                  <Button variant="outline" size="sm" onClick={() => setSoapFor(selected)}>
                    <FileText className="mr-2 size-4" />
                    Añadir nota
                  </Button>
                )}
              </div>
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin notas de evolución.</p>
              ) : (
                <div className="space-y-3">
                  {rootNotes.map((n) => {
                    const addenda = addendaByNote.get(n.id) ?? []
                    return (
                      <div key={n.id} className="rounded-md border p-3 text-sm">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {formatDateTime(n.created_at)}
                            {n.signed_at && (
                              <Badge variant="secondary">Firmada {formatDateTime(n.signed_at)}</Badge>
                            )}
                          </div>
                          {isProfessional && selected.professional_id === session?.user.id && (
                            n.signed_at ? (
                              <Button variant="ghost" size="sm" onClick={() => setAddendumFor(n)}>
                                <FilePlus2 className="mr-2 size-4" />
                                Adenda
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => setSignConfirmFor(n)}>
                                <PenLine className="mr-2 size-4" />
                                Firmar
                              </Button>
                            )
                          )}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Field label="Subjetivo" value={n.subjective} />
                          <Field label="Objetivo" value={n.objective} />
                          <Field label="Análisis" value={n.analysis} />
                          <Field label="Plan" value={n.plan} />
                        </div>

                        {addenda.length > 0 && (
                          <div className="mt-3 space-y-3">
                            {addenda.map((ad) => (
                              <div key={ad.id} className="rounded-md border-l-2 border-primary/40 bg-muted/30 p-3">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span className="font-medium tracking-wide text-foreground uppercase">Adenda</span>
                                    {formatDateTime(ad.created_at)}
                                    {ad.signed_at && (
                                      <Badge variant="secondary">Firmada {formatDateTime(ad.signed_at)}</Badge>
                                    )}
                                  </div>
                                  {isProfessional &&
                                    selected.professional_id === session?.user.id &&
                                    !ad.signed_at && (
                                      <Button variant="ghost" size="sm" onClick={() => setSignConfirmFor(ad)}>
                                        <PenLine className="mr-2 size-4" />
                                        Firmar
                                      </Button>
                                    )}
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <Field label="Subjetivo" value={ad.subjective} />
                                  <Field label="Objetivo" value={ad.objective} />
                                  <Field label="Análisis" value={ad.analysis} />
                                  <Field label="Plan" value={ad.plan} />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Plan de tratamiento</h3>
                {isProfessional && selected.professional_id === session?.user.id && (
                  <Button variant="outline" size="sm" onClick={() => setPlanOpen(true)}>
                    <Target className="mr-2 size-4" />
                    Nuevo plan
                  </Button>
                )}
              </div>
              {treatmentPlansQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : patientPlans.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin plan de tratamiento para este paciente (RF23).
                </p>
              ) : (
                <div className="space-y-3">
                  {patientPlans.map((p) => {
                    const meta = planStatusMeta[p.status as TreatmentPlanStatus] ?? planStatusMeta.active
                    return (
                      <div key={p.id} className="rounded-md border p-3 text-sm">
                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                            <span className="text-xs text-muted-foreground">
                              Inicio {p.starts_on}
                              {p.ends_on ? ` · Fin ${p.ends_on}` : ''}
                              {p.suggested_frequency ? ` · ${p.suggested_frequency}` : ''}
                              {p.duration_weeks ? ` · ${p.duration_weeks} semanas` : ''}
                            </span>
                          </div>
                          {isProfessional && selected.professional_id === session?.user.id && (
                            <div className="flex items-center gap-1">
                              {p.status !== 'completed' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => changePlanStatus(p, 'completed')}
                                  title="Marcar como completado"
                                >
                                  Completar
                                </Button>
                              )}
                              {p.status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => changePlanStatus(p, 'cancelled')}
                                  title="Cancelar plan"
                                >
                                  Cancelar
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => setPlanFor(p)}>
                                <ClipboardList className="size-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="whitespace-pre-wrap">{p.objectives}</div>
                        {p.notes && (
                          <p className="mt-2 border-t pt-2 text-xs text-muted-foreground">{p.notes}</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Diagnóstico</h3>
                {isProfessional && selected.professional_id === session?.user.id && (
                  <Button variant="outline" size="sm" onClick={() => setDiagnosisOpen(true)}>
                    <ListChecks className="mr-2 size-4" />
                    Nuevo diagnóstico
                  </Button>
                )}
              </div>
              {diagnosesQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : patientDiagnoses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin diagnósticos para este paciente (RF22).
                </p>
              ) : (
                <div className="space-y-3">
                  {patientDiagnoses.map((d) => (
                    <div key={d.id} className="rounded-md border p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {d.is_primary && <Badge>Principal</Badge>}
                          <span className="font-medium">{d.icd11_code}</span>
                          <span>{d.icd11_label}</span>
                        </div>
                        {isProfessional && selected.professional_id === session?.user.id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            onClick={() => setDiagnosisFor(d)}
                          >
                            <ClipboardList className="size-4" />
                          </Button>
                        )}
                      </div>
                      {d.description && (
                        <p className="border-t pt-2 text-xs text-muted-foreground">{d.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Escalas de evaluación</h3>
                {isProfessional && selected.professional_id === session?.user.id && (
                  <Button variant="outline" size="sm" onClick={() => setAssessmentOpen(true)}>
                    <Activity className="mr-2 size-4" />
                    Registrar escala
                  </Button>
                )}
              </div>
              {assessmentsQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : patientAssessments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin escalas registradas para este paciente (RF24).
                </p>
              ) : (
                <div className="space-y-3">
                  {patientAssessments.map((a) => (
                    <div key={a.id} className="rounded-md border p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge>{SCALE_LABELS[a.scale_code as AssessmentScaleCode] ?? a.scale_code}</Badge>
                        <span className="font-medium">{a.total_score} pts</span>
                        <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
                        <span className="text-xs text-muted-foreground">{a.assessed_on}</span>
                      </div>
                      {a.notes && (
                        <p className="border-t pt-2 text-xs text-muted-foreground">{a.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">Alertas de riesgo</h3>
                {isProfessional && selected.professional_id === session?.user.id && (
                  <Button variant="outline" size="sm" onClick={() => setRiskOpen(true)}>
                    <ShieldAlert className="mr-2 size-4" />
                    Registrar alerta
                  </Button>
                )}
              </div>
              {riskAlertsQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : sessionAlerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Sin alertas de riesgo para esta sesión (RF27).
                </p>
              ) : (
                <div className="space-y-3">
                  {sessionAlerts.map((a) => (
                    <div key={a.id} className="rounded-md border p-3 text-sm">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant={RISK_LEVEL_VARIANT[a.level as keyof typeof RISK_LEVEL_VARIANT] ?? 'outline'}>
                          {RISK_LEVEL_LABELS[a.level as keyof typeof RISK_LEVEL_LABELS] ?? a.level}
                        </Badge>
                        {a.status === 'open' ? (
                          <Badge variant="secondary">Abierta</Badge>
                        ) : (
                          <Badge variant="outline">Resuelta</Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</span>
                      </div>
                      {a.description && (
                        <p className="border-t pt-2 text-xs text-muted-foreground">{a.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>
        </Card>
      )}

      <NewSessionDialog tenantId={activeTenantId} open={newOpen} onOpenChange={setNewOpen} />

      {anamnesisFor && (
        <AnamnesisDialog
          tenantId={activeTenantId}
          sessionId={anamnesisFor.id}
          patientId={anamnesisFor.patient_id}
          initial={anamnesisFor.anamnesis?.[0] ?? null}
          open
          onOpenChange={(next) => {
            if (!next) setAnamnesisFor(null)
          }}
        />
      )}

      {soapFor && (
        <SoapNoteDialog
          tenantId={activeTenantId}
          sessionId={soapFor.id}
          patientId={soapFor.patient_id}
          open
          onOpenChange={(next) => {
            if (!next) setSoapFor(null)
          }}
        />
      )}

      {addendumFor && selected && (
        <SoapNoteDialog
          tenantId={activeTenantId}
          sessionId={selected.id}
          patientId={selected.patient_id}
          addendumOf={addendumFor.id}
          open
          onOpenChange={(next) => {
            if (!next) setAddendumFor(null)
          }}
        />
      )}

      {signConfirmFor && selected && (
        <Dialog open onOpenChange={(next) => { if (!next) setSignConfirmFor(null) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Firmar nota de evolución (RN10)</DialogTitle>
              <DialogDescription>
                Al firmar la nota queda <span className="font-medium text-foreground">inmutable</span>:
                no podrá editarse ni eliminarse, y será parte del registro clínico firmado.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Si necesitas corregir o ampliar el contenido después de firmar, solo podrás agregar
              una <span className="font-medium text-foreground">adenda</span> que se sumará a esta
              nota sin modificar el original.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSignConfirmFor(null)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  if (!session?.user.id) return
                  signNote(signConfirmFor)
                  setSignConfirmFor(null)
                }}
              >
                <PenLine className="mr-2 size-4" />
                Confirmar y firmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {selected && (
        <TreatmentPlanDialog
          tenantId={activeTenantId}
          patientId={selected.patient_id}
          patientName={`${selected.patient?.first_name ?? ''} ${selected.patient?.last_name ?? ''}`.trim()}
          professionalId={session?.user.id ?? ''}
          initial={planFor}
          open={planFor !== null || planOpen}
          onOpenChange={(next) => {
            setPlanFor(null)
            setPlanOpen(next)
          }}
        />
      )}

      {selected && (
        <DiagnosisDialog
          tenantId={activeTenantId}
          patientId={selected.patient_id}
          patientName={`${selected.patient?.first_name ?? ''} ${selected.patient?.last_name ?? ''}`.trim()}
          professionalId={session?.user.id ?? ''}
          sessionId={selected.id}
          initial={diagnosisFor}
          open={diagnosisFor !== null || diagnosisOpen}
          onOpenChange={(next) => {
            setDiagnosisFor(null)
            setDiagnosisOpen(next)
          }}
        />
      )}

      {selected && (
        <AssessmentDialog
          tenantId={activeTenantId}
          patientId={selected.patient_id}
          patientName={`${selected.patient?.first_name ?? ''} ${selected.patient?.last_name ?? ''}`.trim()}
          professionalId={session?.user.id ?? ''}
          sessionId={selected.id}
          open={assessmentOpen}
          onOpenChange={setAssessmentOpen}
        />
      )}

      {selected && (
        <RiskAlertDialog
          tenantId={activeTenantId}
          patientId={selected.patient_id}
          patientName={`${selected.patient?.first_name ?? ''} ${selected.patient?.last_name ?? ''}`.trim()}
          professionalId={session?.user.id ?? ''}
          sessionId={selected.id}
          open={riskOpen}
          onOpenChange={setRiskOpen}
        />
      )}
    </div>
  )
}

function Field({ label, value, wide }: { label: string; value?: string | null; wide?: boolean }) {
  if (!value) return null
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="whitespace-pre-wrap">{value}</dd>
    </div>
  )
}
