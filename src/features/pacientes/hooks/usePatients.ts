import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { DocumentTemplate, InformedConsent, Patient } from '@/lib/database.types'

export type PatientWithGuardian = Patient & {
  legal_guardian: (LegalGuardianFields & { id: string }) | null
}

export type LegalGuardianFields = {
  full_name: string
  identity_doc_type: string | null
  identity_doc_number: string | null
  phone: string | null
  email: string | null
  relationship: string
}

export type PatientForm = {
  first_name: string
  last_name: string
  birth_date: string
  gender: string
  identity_doc_type: string
  identity_doc_number: string
  phone: string
  email: string
  address: string
  medical_record_number: string
  is_minor: boolean
  guardian: LegalGuardianFields | null
}

export type InformedConsentWithTemplate = InformedConsent & {
  document_template: Pick<DocumentTemplate, 'title' | 'version'> | null
}

export function usePatients(tenantId: string | null) {
  return useQuery({
    queryKey: ['patients', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patient')
        .select('*, legal_guardian(*)')
        .eq('tenant_id', tenantId!)
        .order('last_name')
      if (error) throw error
      return data as PatientWithGuardian[]
    },
  })
}

export function useConsentsByTenant(tenantId: string | null) {
  return useQuery({
    queryKey: ['informed_consent', tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('informed_consent')
        .select('*, document_template(title, version)')
        .eq('tenant_id', tenantId!)
        .order('signed_at', { ascending: false })
      if (error) throw error
      return data as InformedConsentWithTemplate[]
    },
  })
}

export function useConsentTemplate(tenantId: string | null) {
  return useQuery({
    queryKey: ['document_template', tenantId, 'informed_consent'],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_template')
        .select('*')
        .eq('tenant_id', tenantId!)
        .eq('code', 'informed_consent')
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data as DocumentTemplate | null
    },
  })
}

export function useUpsertPatient(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: PatientForm }) => {
      const patientPayload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        birth_date: form.birth_date,
        gender: form.gender || null,
        identity_doc_type: form.identity_doc_type || null,
        identity_doc_number: form.identity_doc_number.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        is_minor: form.is_minor,
      }

      let patientId = id
      if (id) {
        const { error } = await supabase
          .from('patient')
          .update(patientPayload)
          .eq('id', id)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('patient')
          .insert({ tenant_id: tenantId, ...patientPayload, medical_record_number: null })
          .select('id')
          .single()
        if (error) throw error
        patientId = data.id
      }

      if (!patientId) return

      if (form.is_minor && form.guardian?.full_name.trim()) {
        const guardianPayload = {
          tenant_id: tenantId,
          patient_id: patientId,
          full_name: form.guardian.full_name.trim(),
          identity_doc_type: form.guardian.identity_doc_type || null,
          identity_doc_number: form.guardian.identity_doc_number?.trim() || null,
          phone: form.guardian.phone?.trim() || null,
          email: form.guardian.email?.trim() || null,
          relationship: form.guardian.relationship.trim(),
        }
        const { error } = await supabase.from('legal_guardian').upsert(guardianPayload, {
          onConflict: 'patient_id',
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('legal_guardian').delete().eq('patient_id', patientId)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', tenantId] })
    },
  })
}

export function useSetPatientStatus(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'active' | 'inactive' }) => {
      const { error } = await supabase.from('patient').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patients', tenantId] })
    },
  })
}

export function useRegisterConsent(tenantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      patientId,
      templateId,
      file,
    }: {
      patientId: string
      templateId: string
      file: File | null
    }) => {
      let evidenceUrl: string | null = null
      if (file) {
        const path = `${tenantId}/consents/${patientId}/${crypto.randomUUID()}-${file.name}`
        const { error: uploadError } = await supabase.storage
          .from('clinical-docs')
          .upload(path, file)
        if (uploadError) throw new Error(`No se pudo subir el documento: ${uploadError.message}`)
        evidenceUrl = path
      }

      const { data, error } = await supabase.functions.invoke('register_consent', {
        body: { tenantId, patientId, templateId, evidenceUrl },
      })
      if (error) throw error
      const result = data as { error?: string }
      if (result.error) {
        throw new Error(result.error)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['informed_consent', tenantId] })
    },
  })
}
