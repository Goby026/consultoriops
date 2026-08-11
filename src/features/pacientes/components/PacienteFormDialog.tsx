import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUpsertPatient } from '@/features/pacientes/hooks/usePatients'
import type { PatientForm, PatientWithGuardian } from '@/features/pacientes/hooks/usePatients'

const GENDERS = [
  { value: 'female', label: 'Femenino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Otro' },
]

const DOC_TYPES = [
  { value: 'DNI', label: 'DNI' },
  { value: 'CE', label: 'Carné de Extranjería' },
  { value: 'PASSPORT', label: 'Pasaporte' },
  { value: 'OTHER', label: 'Otro' },
]

function emptyForm(): PatientForm {
  return {
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    identity_doc_type: 'DNI',
    identity_doc_number: '',
    phone: '',
    email: '',
    address: '',
    medical_record_number: '',
    is_minor: false,
    guardian: null,
  }
}

function toForm(patient: PatientWithGuardian): PatientForm {
  return {
    first_name: patient.first_name,
    last_name: patient.last_name,
    birth_date: patient.birth_date,
    gender: patient.gender ?? '',
    identity_doc_type: patient.identity_doc_type ?? 'DNI',
    identity_doc_number: patient.identity_doc_number ?? '',
    phone: patient.phone ?? '',
    email: patient.email ?? '',
    address: patient.address ?? '',
    medical_record_number: patient.medical_record_number ?? '',
    is_minor: patient.is_minor,
    guardian: patient.legal_guardian
      ? {
          full_name: patient.legal_guardian.full_name,
          identity_doc_type: patient.legal_guardian.identity_doc_type ?? 'DNI',
          identity_doc_number: patient.legal_guardian.identity_doc_number ?? '',
          phone: patient.legal_guardian.phone ?? '',
          email: patient.legal_guardian.email ?? '',
          relationship: patient.legal_guardian.relationship,
        }
      : null,
  }
}

export function PacienteFormDialog({
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
  const [form, setForm] = useState<PatientForm>(emptyForm())
  const mutation = useUpsertPatient(tenantId)

  const isEditing = patient !== null

  useEffect(() => {
    if (open) {
      setForm(patient ? toForm(patient) : emptyForm())
    }
  }, [open, patient])

  const set = <K extends keyof PatientForm>(field: K, value: PatientForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const setGuardian = <K extends keyof NonNullable<PatientForm['guardian']>>(
    field: K,
    value: string,
  ) =>
    setForm((prev) => ({
      ...prev,
      guardian: {
        full_name: '',
        identity_doc_type: 'DNI',
        identity_doc_number: '',
        phone: '',
        email: '',
        relationship: '',
        ...prev.guardian,
        [field]: value,
      },
    }))

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    mutation.mutate(
      { id: patient?.id, form },
      {
        onSuccess: () => {
          toast.success(isEditing ? 'Paciente actualizado' : 'Paciente registrado')
          onOpenChange(false)
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar paciente' : 'Registrar paciente'}</DialogTitle>
            <DialogDescription>
              Datos personales del paciente y del representante legal si es menor de edad (RF04).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pat-first-name">Nombres</Label>
              <Input
                id="pat-first-name"
                value={form.first_name}
                onChange={(e) => set('first_name', e.target.value)}
                placeholder="Ej. Ana María"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-last-name">Apellidos</Label>
              <Input
                id="pat-last-name"
                value={form.last_name}
                onChange={(e) => set('last_name', e.target.value)}
                placeholder="Ej. Torres Gutiérrez"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-birth-date">Fecha de nacimiento</Label>
              <Input
                id="pat-birth-date"
                type="date"
                value={form.birth_date}
                onChange={(e) => set('birth_date', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-gender">Género</Label>
              <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
                <SelectTrigger id="pat-gender" className="w-full">
                  <SelectValue placeholder="Selecciona" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-doc-type">Tipo de documento</Label>
              <Select
                value={form.identity_doc_type}
                onValueChange={(v) => set('identity_doc_type', v)}
              >
                <SelectTrigger id="pat-doc-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-doc-number">N.° de documento</Label>
              <Input
                id="pat-doc-number"
                value={form.identity_doc_number}
                onChange={(e) => set('identity_doc_number', e.target.value)}
                placeholder="Ej. 45236789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-record-number">N.° de historia clínica</Label>
              <Input
                id="pat-record-number"
                value={form.medical_record_number}
                onChange={() => {}}
                placeholder={isEditing ? '' : 'Se asigna automáticamente'}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Se genera de forma automática y correlativa por consultorio (HCL-0001, HCL-0002, …).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-phone">Teléfono</Label>
              <Input
                id="pat-phone"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="Ej. +51 987 654 321"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pat-email">Correo</Label>
              <Input
                id="pat-email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="Ej. ana@correo.com"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="pat-address">Dirección</Label>
              <Textarea
                id="pat-address"
                value={form.address}
                onChange={(e) => set('address', e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-md border px-3 py-2">
            <input
              id="pat-is-minor"
              type="checkbox"
              checked={form.is_minor}
              onChange={(e) => set('is_minor', e.target.checked)}
              className="size-4"
            />
            <Label htmlFor="pat-is-minor" className="cursor-pointer">
              Paciente menor de edad
            </Label>
          </div>

          {form.is_minor && (
            <div className="space-y-4 rounded-md border p-4">
              <p className="text-sm font-medium">Representante legal (RF04, RN11)</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="guardian-name">Nombre completo</Label>
                  <Input
                    id="guardian-name"
                    value={form.guardian?.full_name ?? ''}
                    onChange={(e) => setGuardian('full_name', e.target.value)}
                    placeholder="Ej. Jorge Torres"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian-relationship">Parentesco</Label>
                  <Input
                    id="guardian-relationship"
                    value={form.guardian?.relationship ?? ''}
                    onChange={(e) => setGuardian('relationship', e.target.value)}
                    placeholder="Ej. Padre, Madre, Tutor"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian-doc-type">Tipo de documento</Label>
                  <Select
                    value={form.guardian?.identity_doc_type ?? 'DNI'}
                    onValueChange={(v) => setGuardian('identity_doc_type', v)}
                  >
                    <SelectTrigger id="guardian-doc-type" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DOC_TYPES.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian-doc-number">N.° de documento</Label>
                  <Input
                    id="guardian-doc-number"
                    value={form.guardian?.identity_doc_number ?? ''}
                    onChange={(e) => setGuardian('identity_doc_number', e.target.value)}
                    placeholder="Ej. 40211234"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian-phone">Teléfono</Label>
                  <Input
                    id="guardian-phone"
                    value={form.guardian?.phone ?? ''}
                    onChange={(e) => setGuardian('phone', e.target.value)}
                    placeholder="Ej. +51 999 888 777"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guardian-email">Correo</Label>
                  <Input
                    id="guardian-email"
                    type="email"
                    value={form.guardian?.email ?? ''}
                    onChange={(e) => setGuardian('email', e.target.value)}
                    placeholder="Ej. jorge@correo.com"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Registrar paciente'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
