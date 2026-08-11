import { useMemo, useState } from 'react'
import { FileSignature, Loader2, Pencil, Plus, Search, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useActiveTenant } from '@/features/tenants/hooks/activeTenantContext'
import { PacienteFormDialog } from './PacienteFormDialog'
import { ConsentDialog } from './ConsentDialog'
import {
  useConsentsByTenant,
  usePatients,
  useSetPatientStatus,
} from '@/features/pacientes/hooks/usePatients'
import type { PatientWithGuardian } from '@/features/pacientes/hooks/usePatients'

function ageFromBirthDate(birthDate: string) {
  const birth = new Date(birthDate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const m = now.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--
  return age
}

export function PacientesPage() {
  const { activeTenantId } = useActiveTenant()
  const patientsQuery = usePatients(activeTenantId)
  const consentsQuery = useConsentsByTenant(activeTenantId)
  const setStatusMutation = useSetPatientStatus(activeTenantId ?? '')

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PatientWithGuardian | null>(null)
  const [consentFor, setConsentFor] = useState<PatientWithGuardian | null>(null)

  const latestConsentByPatient = useMemo(() => {
    const map = new Map<string, { version: number | null; signed_at: string }>()
    for (const c of consentsQuery.data ?? []) {
      if (!map.has(c.patient_id)) {
        map.set(c.patient_id, {
          version: c.document_template?.version ?? null,
          signed_at: c.signed_at,
        })
      }
    }
    return map
  }, [consentsQuery.data])

  const patients = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (patientsQuery.data ?? []).filter((p) => {
      if (!q) return true
      const full = `${p.first_name} ${p.last_name}`.toLowerCase()
      return (
        full.includes(q) ||
        (p.identity_doc_number ?? '').toLowerCase().includes(q) ||
        (p.medical_record_number ?? '').toLowerCase().includes(q)
      )
    })
  }, [patientsQuery.data, search])

  if (!activeTenantId) {
    return <p className="text-muted-foreground">Selecciona un consultorio para ver sus pacientes.</p>
  }

  const toggleStatus = (p: PatientWithGuardian) => {
    setStatusMutation.mutate(
      { id: p.id, status: p.status === 'active' ? 'inactive' : 'active' },
      {
        onSuccess: (_, vars) => {
          toast.success(vars.status === 'active' ? 'Paciente activado' : 'Paciente desactivado')
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
          <p className="text-muted-foreground">
            Registro y consulta de pacientes del consultorio (RF04, RF05, RF06).
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null)
            setFormOpen(true)
          }}
        >
          <Plus className="mr-2 size-4" />
          Registrar paciente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Listado de pacientes</CardTitle>
          <CardDescription>Busca por nombre, documento o N.° de historia clínica.</CardDescription>
          <div className="relative max-w-md pt-2">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="pl-8"
            />
          </div>
        </CardHeader>
        <CardContent>
          {patientsQuery.isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : patients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay pacientes registrados.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Edad</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Consentimiento</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patients.map((p) => {
                  const consent = latestConsentByPatient.get(p.id)
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.medical_record_number || 'Sin N.° HCL'}
                          {p.is_minor && <Badge variant="outline" className="ml-2">Menor</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.identity_doc_type ? `${p.identity_doc_type} ${p.identity_doc_number ?? ''}` : '—'}
                      </TableCell>
                      <TableCell>{ageFromBirthDate(p.birth_date)} años</TableCell>
                      <TableCell className="text-muted-foreground">
                        <div>{p.phone || '—'}</div>
                        <div className="text-xs">{p.email || ''}</div>
                      </TableCell>
                      <TableCell>
                        {consent ? (
                          <Badge variant="secondary">
                            Firmado v{consent.version ?? '?'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Pendiente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'active' ? 'secondary' : 'outline'}>
                          {p.status === 'active' ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Consentimiento informado"
                            onClick={() => setConsentFor(p)}
                          >
                            <FileSignature className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Editar"
                            onClick={() => {
                              setEditing(p)
                              setFormOpen(true)
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={p.status === 'active' ? 'Desactivar' : 'Activar'}
                            onClick={() => toggleStatus(p)}
                          >
                            {p.status === 'active' ? (
                              <UserMinus className="size-4 text-destructive" />
                            ) : (
                              <UserPlus className="size-4" />
                            )}
                          </Button>
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

      <PacienteFormDialog
        tenantId={activeTenantId}
        patient={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      <ConsentDialog
        tenantId={activeTenantId}
        patient={consentFor}
        open={consentFor !== null}
        onOpenChange={(next) => {
          if (!next) setConsentFor(null)
        }}
      />
    </div>
  )
}
