import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, FileText, Loader2, Printer } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { supabase } from '@/lib/supabaseClient'
import { useSession } from '@/features/auth/hooks/useSession'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { useMemberships } from '@/features/tenants/hooks/useMemberships'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { usePatients } from '@/features/pacientes/hooks/usePatients'
import { useTenantMembers } from '@/features/configuracion/hooks/useMembers'
import {
  logClinicalHistoryAccess,
  useClinicalHistory,
  usePatientTreatmentPlans,
} from '@/features/pacientes/hooks/useClinicalHistory'
import type { ClinicalSession } from '@/features/pacientes/hooks/useClinicalHistory'
import { formatDate, formatDateTime } from '@/features/sesiones/utils'
import type { AssessmentResult, ProgressNote, TreatmentPlan } from '@/lib/database.types'

function ageFromBirthDate(birthDate: string) {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
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

function ScaleEvolution({ results }: { results: AssessmentResult[] }) {
  const sorted = useMemo(
    () => [...results].sort((a, b) => a.assessed_on.localeCompare(b.assessed_on)),
    [results],
  )
  if (sorted.length < 2) return null
  const width = 220
  const height = 56
  const pad = 8
  const scores = sorted.map((r) => Number(r.total_score))
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const points = sorted.map((r, i) => ({
    x: pad + (i / (sorted.length - 1)) * (width - pad * 2),
    y: height - pad - ((Number(r.total_score) - min) / range) * (height - pad * 2),
  }))
  const line = points.map((p) => `${p.x},${p.y}`).join(' ')
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-14 w-56"
      role="img"
      aria-label="Evolución temporal del puntaje"
    >
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" className="fill-current" />
      ))}
    </svg>
  )
}

function SoapNoteBlock({ note }: { note: ProgressNote }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium uppercase text-muted-foreground">Nota SOAP</p>
        {note.signed_at ? (
          <Badge variant="secondary">Firmada · {formatDateTime(note.signed_at)}</Badge>
        ) : (
          <Badge variant="outline">Sin firmar</Badge>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Subjetivo" value={note.subjective} wide />
        <Field label="Objetivo" value={note.objective} />
        <Field label="Análisis" value={note.analysis} />
        <Field label="Plan" value={note.plan} />
      </div>
    </div>
  )
}

function TreatmentPlansBlock({
  plans,
  memberMap,
}: {
  plans: TreatmentPlan[]
  memberMap: Map<string, string>
}) {
  if (plans.length === 0) return null
  return (
    <section>
      <h4 className="mb-2 text-sm font-medium">Plan de tratamiento</h4>
      <div className="space-y-3">
        {plans.map((tp) => (
          <div key={tp.id} className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{tp.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {tp.starts_on} → {tp.ends_on ?? 'sin fin'}
              </span>
              {tp.suggested_frequency && (
                <span className="text-xs text-muted-foreground">{tp.suggested_frequency}</span>
              )}
              {memberMap.get(tp.professional_id) && (
                <span className="text-xs text-muted-foreground">
                  · {memberMap.get(tp.professional_id)}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap text-sm">{tp.objectives}</p>
            {tp.notes && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{tp.notes}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function ClinicalSections({ session }: { session: ClinicalSession }) {
  const anamnesis = session.anamnesis
  const originals = (session.progress_note ?? []).filter((n) => !n.addendum_of)
  const addenda = (session.progress_note ?? []).filter((n) => n.addendum_of)
  const byScale = useMemo(() => {
    const map = new Map<string, AssessmentResult[]>()
    for (const r of session.assessment_result ?? []) {
      const arr = map.get(r.scale_code) ?? []
      arr.push(r)
      map.set(r.scale_code, arr)
    }
    return map
  }, [session.assessment_result])

  return (
    <div className="space-y-5">
      {anamnesis && (
        <section>
          <h4 className="mb-2 text-sm font-medium">Anamnesis</h4>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <Field label="Motivo de consulta" value={anamnesis.reason_for_consultation} wide />
            <Field label="Antecedentes personales" value={anamnesis.personal_background} />
            <Field label="Antecedentes familiares" value={anamnesis.family_background} />
            <Field label="Historia del problema actual" value={anamnesis.problem_history} wide />
            <Field label="Evaluación de factores de riesgo" value={anamnesis.risk_assessment} wide />
          </div>
        </section>
      )}

      {originals.length > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-medium">Notas de evolución SOAP</h4>
          <div className="space-y-4">
            {originals.map((note) => (
              <div key={note.id} className="rounded-lg border p-3">
                <SoapNoteBlock note={note} />
                {addenda
                  .filter((a) => a.addendum_of === note.id)
                  .map((a) => (
                    <div key={a.id} className="mt-3 border-t pt-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-medium uppercase text-muted-foreground">
                          Adenda
                        </p>
                        {a.signed_at ? (
                          <Badge variant="secondary">Firmada · {formatDateTime(a.signed_at)}</Badge>
                        ) : (
                          <Badge variant="outline">Sin firmar</Badge>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Subjetivo" value={a.subjective} wide />
                        <Field label="Objetivo" value={a.objective} />
                        <Field label="Análisis" value={a.analysis} />
                        <Field label="Plan" value={a.plan} />
                      </div>
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {(session.diagnosis?.length ?? 0) > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-medium">Diagnósticos</h4>
          <div className="space-y-2">
            {(session.diagnosis ?? []).map((d) => (
              <div key={d.id} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {d.icd11_code} · {d.icd11_label}
                  </p>
                  {d.description && (
                    <p className="text-sm text-muted-foreground">{d.description}</p>
                  )}
                </div>
                {d.is_primary && <Badge>Primario</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}

      {byScale.size > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-medium">Escalas de evaluación</h4>
          <div className="space-y-4">
            {[...byScale.entries()].map(([code, results]) => (
              <div key={code} className="space-y-2">
                <p className="text-sm font-medium">{code}</p>
                <ScaleEvolution results={results} />
                <div className="grid gap-1 sm:grid-cols-2">
                  {[...results]
                    .sort((a, b) => a.assessed_on.localeCompare(b.assessed_on))
                    .map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm">
                        <span>{formatDate(r.assessed_on)}</span>
                        <span className="tabular-nums">
                          {r.total_score} · {r.severity}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(session.risk_alert?.length ?? 0) > 0 && (
        <section>
          <h4 className="mb-2 text-sm font-medium">Alertas de riesgo</h4>
          <div className="space-y-2">
            {(session.risk_alert ?? []).map((ra) => (
              <div key={ra.id} className="flex items-start justify-between gap-3">
                <div>
                  <Badge variant="destructive">{ra.level}</Badge>
                  {ra.description && <p className="mt-1 text-sm">{ra.description}</p>}
                </div>
                <Badge variant={ra.resolved_at ? 'secondary' : 'destructive'}>
                  {ra.resolved_at ? 'Resuelta' : 'Activa'}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

export function HistorialClinicoPage() {
  const { patientId = '' } = useParams()
  const navigate = useNavigate()
  const { session } = useSession()
  const { activeTenantId } = useActiveTenant()
  const membershipsQuery = useMemberships(session?.user.id)
  const profileQuery = useProfile(session?.user.id)

  const activeMembership = membershipsQuery.data?.find((m) => m.tenant_id === activeTenantId)
  const roleCode = activeMembership?.role?.code ?? ''
  const isPlatformAdmin = profileQuery.data?.is_platform_admin === true
  const isClinical = isPlatformAdmin || roleCode === 'tenant_admin' || roleCode === 'professional'

  const patientsQuery = usePatients(activeTenantId)
  const patient = useMemo(
    () => (patientsQuery.data ?? []).find((p) => p.id === patientId),
    [patientsQuery.data, patientId],
  )
  const historyQuery = useClinicalHistory(activeTenantId, isClinical ? patientId : undefined)
  const plansQuery = usePatientTreatmentPlans(activeTenantId, isClinical ? patientId : undefined)
  const membersQuery = useTenantMembers(activeTenantId)
  const tenantQuery = useQuery({
    queryKey: ['tenant', activeTenantId],
    enabled: Boolean(activeTenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant')
        .select('name')
        .eq('id', activeTenantId!)
        .single()
      if (error) throw error
      return data as { name: string }
    },
  })

  useEffect(() => {
    if (activeTenantId && patientId && isClinical) {
      logClinicalHistoryAccess(activeTenantId, patientId).catch(() => {})
    }
  }, [activeTenantId, patientId, isClinical])

  const memberMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of membersQuery.data ?? []) {
      if (m.user_profile?.full_name) map.set(m.user_id, m.user_profile.full_name)
    }
    return map
  }, [membersQuery.data])

  const sessions = historyQuery.data ?? []
  const openSessions = sessions.filter((s) => s.status === 'open').length
  const unsignedNotes = sessions.reduce(
    (acc, s) => acc + (s.progress_note ?? []).filter((n) => !n.signed_at).length,
    0,
  )
  const activeAlerts = sessions.reduce(
    (acc, s) => acc + (s.risk_alert ?? []).filter((r) => !r.resolved_at).length,
    0,
  )

  if (!activeTenantId) {
    return <p className="text-muted-foreground">Selecciona un consultorio para ver el historial.</p>
  }

  if (!patientsQuery.isLoading && !patient) {
    return (
      <div className="space-y-4">
        <EmptyState
          icon={FileText}
          title="Paciente no encontrado"
          hint="El paciente no existe o pertenece a otro consultorio."
        />
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => navigate('/app/pacientes')}>
            <ArrowLeft className="mr-2 size-4" />
            Volver a pacientes
          </Button>
        </div>
      </div>
    )
  }

  const patientHeader = patient && (
    <Card>
      <CardHeader>
        <CardTitle>
          {patient.first_name} {patient.last_name}
        </CardTitle>
        <CardDescription>
          {patient.medical_record_number && <>N.° {patient.medical_record_number} · </>}
          {patient.identity_doc_type} {patient.identity_doc_number ?? '—'} ·{' '}
          {ageFromBirthDate(patient.birth_date)} años ·{' '}
          {patient.status === 'active' ? 'Activo' : 'Inactivo'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {activeAlerts > 0 && (
          <Badge variant="destructive">{activeAlerts} alerta(s) de riesgo activa(s)</Badge>
        )}
        {patient.is_minor && patient.legal_guardian && (
          <Badge variant="outline">Tutor: {patient.legal_guardian.full_name}</Badge>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/app/pacientes')}
            title="Volver a pacientes"
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Historial clínico</h1>
            <p className="text-muted-foreground">Ficha clínica consolidada del paciente (RF07).</p>
          </div>
        </div>
        {isClinical && sessions.length > 0 && (
          <Button onClick={() => window.print()}>
            <Printer className="mr-2 size-4" />
            Generar PDF
          </Button>
        )}
      </div>

      {patientHeader}

      {!isClinical ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Solo profesionales y administradores acceden al historial clínico.
            </p>
          </CardContent>
        </Card>
      ) : historyQuery.isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Sin historial clínico"
          hint="No hay sesiones registradas para este paciente."
        />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Sesiones totales</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{sessions.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>En curso</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{openSessions}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Notas sin firmar</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{unsignedNotes}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {plansQuery.data && plansQuery.data.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Plan de tratamiento</CardDescription>
              </CardHeader>
              <CardContent>
                <TreatmentPlansBlock plans={plansQuery.data} memberMap={memberMap} />
              </CardContent>
            </Card>
          )}

          {sessions.map((s) => (
            <Card key={s.id} className="session-block">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{formatDateTime(s.started_at)}</p>
                    <p className="text-sm text-muted-foreground">
                      {s.appointment?.service?.name ?? 'Sin servicio'} ·{' '}
                      {memberMap.get(s.professional_id) ?? '—'}
                    </p>
                  </div>
                  <Badge variant={s.status === 'completed' ? 'secondary' : 'outline'}>
                    {s.status === 'completed' ? 'Completada' : s.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <ClinicalSections session={s} />
              </CardContent>
            </Card>
          ))}
        </>
      )}

      {isClinical && patient && sessions.length > 0 && (
        <div id="print-area">
          <div className="space-y-8 p-8 text-black">
            <div className="text-center">
              <p className="text-sm uppercase tracking-wide">
                {tenantQuery.data?.name ?? 'Consultorio'}
              </p>
              <h1 className="mt-2 text-lg font-semibold underline">Historial Clínico</h1>
              <p className="text-sm">
                Paciente: {patient.first_name} {patient.last_name} (
                {patient.identity_doc_type ?? 'DOC'} {patient.identity_doc_number ?? ''})
              </p>
              <p className="text-sm">
                N.° de historia clínica: {patient.medical_record_number ?? '—'}
              </p>
              <p className="text-sm">
                Generado:{' '}
                {new Date().toLocaleDateString('es-PE', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {plansQuery.data && plansQuery.data.length > 0 && (
              <section className="break-inside-avoid">
                <h2 className="mb-2 border-b border-black pb-1 text-base font-semibold">
                  Plan de tratamiento
                </h2>
                <TreatmentPlansBlock plans={plansQuery.data} memberMap={memberMap} />
              </section>
            )}
            {sessions.map((s) => (
              <section key={s.id} className="break-inside-avoid">
                <h2 className="mb-2 border-b border-black pb-1 text-base font-semibold">
                  Sesión del {formatDateTime(s.started_at)} ·{' '}
                  {s.appointment?.service?.name ?? 'Sin servicio'} ·{' '}
                  {memberMap.get(s.professional_id) ?? '—'}
                </h2>
                <ClinicalSections session={s} />
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}