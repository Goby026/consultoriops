import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ChangeEvent, FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, FileText, Loader2, Printer } from 'lucide-react'
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
import { supabase } from '@/lib/supabaseClient'
import {
  useConsentTemplate,
  useConsentsByTenant,
  useRegisterConsent,
} from '@/features/pacientes/hooks/usePatients'
import type { PatientWithGuardian } from '@/features/pacientes/hooks/usePatients'

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  return new Date(value).toLocaleString('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function ConsentDialog({
  tenantId,
  patient,
  open,
  onOpenChange,
}: {
  tenantId: string
  patient: PatientWithGuardian | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const templateQuery = useConsentTemplate(tenantId)
  const consentsQuery = useConsentsByTenant(tenantId)
  const registerMutation = useRegisterConsent(tenantId)
  const tenantQuery = useQuery({
    queryKey: ['tenant', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant')
        .select('name')
        .eq('id', tenantId)
        .single()
      if (error) throw error
      return data as { name: string }
    },
  })
  const [file, setFile] = useState<File | null>(null)

  useEffect(() => {
    if (open) {
      setFile(null)
    }
  }, [open])

  const patientId = patient?.id
  const consents = patientId
    ? (consentsQuery.data ?? []).filter((c) => c.patient_id === patientId)
    : []
  const latest = consents[0]
  const template = templateQuery.data
  const signedCurrentVersion = Boolean(
    latest && template && latest.document_template_id === template.id,
  )

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!patientId || !template) return
    registerMutation.mutate(
      { patientId, templateId: template.id, file },
      {
        onSuccess: () => {
          toast.success('Consentimiento informado registrado')
          setFile(null)
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  const guardian = patient?.is_minor ? patient.legal_guardian : null
  const signer = guardian
    ? `Representante legal: ${guardian.full_name} (${guardian.relationship})`
    : patient
      ? `${patient.first_name} ${patient.last_name}`
      : ''
  const signerName = guardian ? guardian.full_name : signer
  const identityDocType =
    guardian?.identity_doc_type ?? patient?.identity_doc_type ?? null
  const identityDocNumber =
    guardian?.identity_doc_number ?? patient?.identity_doc_number ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Consentimiento informado</DialogTitle>
          <DialogDescription>
            {patient ? `${patient.first_name} ${patient.last_name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {signedCurrentVersion ? (
            <div className="space-y-3 rounded-md border border-green-300 bg-green-50 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  Consentimiento firmado para este documento
                </p>
              </div>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Documento</dt>
                  <dd className="text-right">{template?.title ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Versión</dt>
                  <dd className="text-right">v{template?.version ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Firmado</dt>
                  <dd className="text-right">{formatDate(latest?.signed_at)}</dd>
                </div>
              </dl>
              {latest?.evidence_url && <EvidenceLink path={latest.evidence_url} />}
              <div>
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 size-4" />
                  Imprimir copia
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {consents.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                  El documento cambió de versión: se requiere una nueva aceptación
                  (v{latest?.document_template?.version} → v{template?.version}).
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="consent-doc">Documento vigente (versión a firmar)</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!template}
                    onClick={() => window.print()}
                  >
                    <Printer className="mr-2 size-4" />
                    Imprimir formato
                  </Button>
                </div>
                {templateQuery.isLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                  </div>
                ) : template ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">
                      {template.title} — v{template.version}
                    </p>
                    <Textarea
                      id="consent-doc"
                      readOnly
                      value={template.content}
                      className="min-h-48"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay una plantilla de consentimiento activa en este consultorio.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="consent-file">Documento firmado (evidencia, opcional)</Label>
                <Input
                  id="consent-file"
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  PDF o imagen del documento firmado. Se guarda de forma segura en el almacenamiento del consultorio (RF10).
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="submit"
                  disabled={registerMutation.isPending || !template}
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 size-4" />
                  )}
                  Registrar aceptación
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>

        {/* Vista imprimible: va fuera del diálogo (portal a <body>) porque el DialogContent
            usa transform/position:fixed, lo que rompe la impresión en múltiples páginas */}
        {template &&
          patient &&
          createPortal(
            <div id="print-area">
              <ConsentPrintSheet
                tenantName={tenantQuery.data?.name ?? 'Consultorio'}
                templateTitle={template.title}
                templateVersion={template.version}
                templateContent={fillTemplatePlaceholders(
                  template.content,
                  signerName,
                  identityDocType,
                  identityDocNumber,
                )}
                patient={patient}
                signer={signer}
              />
            </div>,
            document.body,
          )}
      </DialogContent>
    </Dialog>
  )
}

function ConsentPrintSheet({
  tenantName,
  templateTitle,
  templateVersion,
  templateContent,
  patient,
  signer,
}: {
  tenantName: string
  templateTitle: string
  templateVersion: number
  templateContent: string
  patient: PatientWithGuardian
  signer: string
}) {
  const today = new Date().toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="space-y-6 p-8 text-black">
      <div className="text-center">
        <p className="text-sm uppercase tracking-wide">{tenantName}</p>
        <h1 className="mt-2 text-lg font-semibold underline">{templateTitle}</h1>
        <p className="text-sm">Versión {templateVersion}</p>
      </div>

      <p className="text-sm">
        Fecha: <span className="capitalize">{today}</span>
      </p>

      <div className="space-y-1 text-sm">
        <p>
          <strong>Paciente:</strong> {patient.first_name} {patient.last_name}
          {patient.identity_doc_number && (
            <span>
              {' '}
              ({patient.identity_doc_type ?? 'DOC'} {patient.identity_doc_number})
            </span>
          )}
        </p>
        {patient.is_minor && patient.legal_guardian && (
          <p>
            <strong>{signer}</strong>
          </p>
        )}
        {patient.medical_record_number && (
          <p>
            <strong>N.° de historia clínica:</strong> {patient.medical_record_number}
          </p>
        )}
      </div>

      <div className="whitespace-pre-line text-sm leading-relaxed">{templateContent}</div>

      <div className="space-y-2 pt-8 text-sm">
        <p>{signer || 'Paciente o representante legal'}</p>
        <div className="border-t border-black" />
        <p className="text-xs">Firma y nombre del paciente / representante legal</p>
      </div>

      <div className="space-y-2 pt-8 text-sm">
        <p>&nbsp;</p>
        <div className="border-t border-black" />
        <p className="text-xs">Firma y nombre del profesional que recibió el documento</p>
      </div>

      <p className="pt-8 text-xs text-neutral-600">
        Documento generado por ConsultorioPS · {tenantName}
      </p>
    </div>
  )
}

function fillTemplatePlaceholders(
  content: string,
  signerName: string,
  identityDocType: string | null,
  identityDocNumber: string | null,
): string {
  return content
    .replaceAll('[NOMBRE DEL PACIENTE / REPRESENTANTE LEGAL]', signerName)
    .replaceAll('[TIPO DE DOCUMENTO]', identityDocType ?? '')
    .replaceAll('[NÚMERO]', identityDocNumber ?? '')
}

function EvidenceLink({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    supabase.storage
      .from('clinical-docs')
      .createSignedUrl(path, 3600)
      .then(({ data, error }) => {
        if (!cancelled && data) setUrl(data.signedUrl)
        else if (!cancelled && error) setUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-primary underline"
    >
      <FileText className="size-4" />
      Ver documento firmado
    </a>
  )
}
