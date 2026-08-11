-- ============================================================================
-- ConsultorioPS - Fase 3: Pacientes + Consentimiento Informado
-- ============================================================================
-- Tablas: patient, legal_guardian, document_template, informed_consent.
-- Bucket Storage "clinical-docs" con RLS, políticas RLS y seed de plantilla
-- de consentimiento para tenants existentes. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. patient (RF04: registro, incluye indicador de minoría de edad)
-- ----------------------------------------------------------------------------
create table if not exists public.patient (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenant(id) on delete cascade,
  first_name           text not null,
  last_name            text not null,
  birth_date           date not null,
  gender               text check (gender in ('female', 'male', 'other')),
  identity_doc_type    text,
  identity_doc_number  text,
  phone                text,
  email                text,
  address              text,
  is_minor             boolean not null default false,
  medical_record_number text,
  status               text not null default 'active'
                       check (status in ('active', 'inactive')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (tenant_id, medical_record_number),
  unique (tenant_id, identity_doc_number)
);

create index if not exists idx_patient_tenant on public.patient (tenant_id);
create index if not exists idx_patient_tenant_name on public.patient (tenant_id, last_name, first_name);

drop trigger if exists trg_patient_updated on public.patient;
create trigger trg_patient_updated
  before update on public.patient
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. legal_guardian (representante legal de pacientes menores - RF04/RN11)
-- ----------------------------------------------------------------------------
create table if not exists public.legal_guardian (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenant(id) on delete cascade,
  patient_id           uuid not null references public.patient(id) on delete cascade,
  full_name            text not null,
  identity_doc_type    text,
  identity_doc_number  text,
  phone                text,
  email                text,
  relationship         text not null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (patient_id)
);

create index if not exists idx_legal_guardian_patient on public.legal_guardian (patient_id);

drop trigger if exists trg_legal_guardian_updated on public.legal_guardian;
create trigger trg_legal_guardian_updated
  before update on public.legal_guardian
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. document_template (plantillas y versiones de documentos - RF08)
-- ----------------------------------------------------------------------------
create table if not exists public.document_template (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenant(id) on delete cascade,
  code         text not null,
  version      int not null default 1,
  title        text not null,
  content      text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (tenant_id, code, version)
);

create index if not exists idx_document_template_tenant on public.document_template (tenant_id);

drop trigger if exists trg_document_template_updated on public.document_template;
create trigger trg_document_template_updated
  before update on public.document_template
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. informed_consent (RF08: aceptación con versión vigente y evidencia de firma)
-- ----------------------------------------------------------------------------
create table if not exists public.informed_consent (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenant(id) on delete cascade,
  patient_id            uuid not null references public.patient(id) on delete cascade,
  document_template_id  uuid not null references public.document_template(id),
  accepted_by           uuid references auth.users(id) on delete set null,
  signed_at             timestamptz not null default now(),
  valid_until           timestamptz,
  evidence_url          text,
  status                text not null default 'accepted'
                        check (status in ('accepted')),
  created_at            timestamptz not null default now()
);

create index if not exists idx_informed_consent_tenant on public.informed_consent (tenant_id);
create index if not exists idx_informed_consent_patient on public.informed_consent (patient_id);
create index if not exists idx_informed_consent_patient_status on public.informed_consent (patient_id, status, signed_at);

-- ----------------------------------------------------------------------------
-- 5. Seed de plantilla de consentimiento para tenants existentes
-- ----------------------------------------------------------------------------
do $$
declare
  v_content text :=
'CONSENTIMIENTO INFORMADO PARA ATENCIÓN PSICOLÓGICA

Yo, [NOMBRE DEL PACIENTE / REPRESENTANTE LEGAL], identificado(a) con [TIPO DE DOCUMENTO] N.° [NÚMERO], declaro que he sido informado(a) de manera clara y suficiente sobre la atención psicológica que se me brindará en este consultorio: su naturaleza, alcance, beneficios, riesgos y alternativas.

Declaro que se me ha explicado que:
1. La evaluación y el tratamiento tienen finalidad clínica y serán realizados por profesionales del consultorio.
2. La información compartida es confidencial y solo será accesible por el equipo autorizado del consultorio.
3. Los límites legales de la confidencialidad me fueron explicados.
4. Puedo solicitar información, revocar este consentimiento o suspender el proceso en cualquier momento.
5. Mi historia clínica será almacenada de forma segura y no compartida entre consultorios.

En consecuencia, otorgo mi consentimiento informado de forma libre y voluntaria para recibir la atención psicológica en este consultorio.';
begin
  insert into public.document_template (tenant_id, code, version, title, content, is_active)
  select t.id, 'informed_consent', 1, 'Consentimiento Informado para Atención Psicológica', v_content, true
  from public.tenant t
  on conflict (tenant_id, code, version) do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------

-- patient ----------------------------------------------------------------
alter table public.patient enable row level security;

drop policy if exists "patient_select_member" on public.patient;
create policy "patient_select_member"
  on public.patient for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "patient_insert_staff" on public.patient;
create policy "patient_insert_staff"
  on public.patient for insert to authenticated
  with check (
    public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist'])
  );

drop policy if exists "patient_update_staff" on public.patient;
create policy "patient_update_staff"
  on public.patient for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

drop policy if exists "patient_delete_staff" on public.patient;
create policy "patient_delete_staff"
  on public.patient for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

-- legal_guardian ---------------------------------------------------------
alter table public.legal_guardian enable row level security;

drop policy if exists "legal_guardian_select_member" on public.legal_guardian;
create policy "legal_guardian_select_member"
  on public.legal_guardian for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "legal_guardian_insert_staff" on public.legal_guardian;
create policy "legal_guardian_insert_staff"
  on public.legal_guardian for insert to authenticated
  with check (
    public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist'])
  );

drop policy if exists "legal_guardian_update_staff" on public.legal_guardian;
create policy "legal_guardian_update_staff"
  on public.legal_guardian for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

drop policy if exists "legal_guardian_delete_staff" on public.legal_guardian;
create policy "legal_guardian_delete_staff"
  on public.legal_guardian for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

-- document_template ------------------------------------------------------
alter table public.document_template enable row level security;

drop policy if exists "document_template_select_member" on public.document_template;
create policy "document_template_select_member"
  on public.document_template for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "document_template_insert_tenant_admin" on public.document_template;
create policy "document_template_insert_tenant_admin"
  on public.document_template for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "document_template_update_tenant_admin" on public.document_template;
create policy "document_template_update_tenant_admin"
  on public.document_template for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "document_template_delete_tenant_admin" on public.document_template;
create policy "document_template_delete_tenant_admin"
  on public.document_template for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- informed_consent -------------------------------------------------------
-- Select: miembros del tenant. Insert: staff en nombre del paciente.
-- Sin update/delete: el consentimiento firmado es inmutable (RF08, 5.3).
alter table public.informed_consent enable row level security;

drop policy if exists "informed_consent_select_member" on public.informed_consent;
create policy "informed_consent_select_member"
  on public.informed_consent for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "informed_consent_insert_staff" on public.informed_consent;
create policy "informed_consent_insert_staff"
  on public.informed_consent for insert to authenticated
  with check (
    public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist'])
  );

-- ----------------------------------------------------------------------------
-- 7. Storage: bucket de documentos clínicos (RF10)
--    Ruta: clinical-docs/{tenant_id}/consents/{patient_id}/{archivo}
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('clinical-docs', 'clinical-docs', false, 10485760)
on conflict (id) do nothing;

drop policy if exists "clinical_docs_insert_staff" on storage.objects;
create policy "clinical_docs_insert_staff"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'clinical-docs'
    and cardinality(storage.foldername(name)) > 0
    and public.has_role_in_tenant(
      (storage.foldername(name))[1]::uuid,
      array['tenant_admin', 'professional', 'receptionist']
    )
  );

drop policy if exists "clinical_docs_select_member" on storage.objects;
create policy "clinical_docs_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinical-docs'
    and cardinality(storage.foldername(name)) > 0
    and public.is_tenant_member((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "clinical_docs_delete_staff" on storage.objects;
create policy "clinical_docs_delete_staff"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'clinical-docs'
    and cardinality(storage.foldername(name)) > 0
    and public.has_role_in_tenant(
      (storage.foldername(name))[1]::uuid,
      array['tenant_admin', 'professional', 'receptionist']
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Auditoría de cambios (RF-SaaS10 / 6.7)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_audit_patient on public.patient;
create trigger trg_audit_patient
  after insert or update or delete on public.patient
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_legal_guardian on public.legal_guardian;
create trigger trg_audit_legal_guardian
  after insert or update or delete on public.legal_guardian
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_document_template on public.document_template;
create trigger trg_audit_document_template
  after insert or update or delete on public.document_template
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_informed_consent on public.informed_consent;
create trigger trg_audit_informed_consent
  after insert or update or delete on public.informed_consent
  for each row execute function public.log_audit();
