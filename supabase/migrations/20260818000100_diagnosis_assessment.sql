-- ============================================================================
-- ConsultorioPS - Fase 5: Atención Clínica - Diagnóstico y Escalas (RF22, RF24)
-- ============================================================================
-- RF22: diagnóstico con código estandarizado (CIE-11) y descripción libre.
-- RF24: resultados de escalas estandarizadas (PHQ-9, GAD-7) con evolución
-- temporal por paciente.
-- Registros clínicos a nivel de paciente (abarcan varias sesiones), con
-- session_id opcional y sin delete (SRS 5.3).
-- RLS: registro y edición solo profesional dueño; lectura profesional dueño +
-- administrador auditado (RN06, RN13). Idempotente.
-- ============================================================================

create table if not exists public.diagnosis (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  patient_id         uuid not null references public.patient(id) on delete cascade,
  session_id         uuid references public.session(id) on delete set null,
  professional_id    uuid not null references auth.users(id) on delete cascade,
  icd11_code         text not null,
  icd11_label        text not null,
  description        text,
  is_primary         boolean not null default false,
  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (icd11_code <> '')
);

create table if not exists public.assessment_result (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  patient_id         uuid not null references public.patient(id) on delete cascade,
  session_id         uuid references public.session(id) on delete set null,
  professional_id    uuid not null references auth.users(id) on delete cascade,
  scale_code         text not null check (scale_code in ('PHQ-9', 'GAD-7')),
  total_score        numeric not null check (total_score >= 0),
  severity           text not null,
  notes              text,
  assessed_on        date not null default current_date,
  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_diagnosis_tenant on public.diagnosis (tenant_id);
create index if not exists idx_diagnosis_patient on public.diagnosis (patient_id);
create index if not exists idx_diagnosis_professional on public.diagnosis (professional_id);

create index if not exists idx_assessment_tenant on public.assessment_result (tenant_id);
create index if not exists idx_assessment_patient on public.assessment_result (patient_id);
create index if not exists idx_assessment_professional on public.assessment_result (professional_id);
create index if not exists idx_assessment_evolution on public.assessment_result (patient_id, scale_code, assessed_on);

drop trigger if exists trg_diagnosis_updated on public.diagnosis;
create trigger trg_diagnosis_updated
  before update on public.diagnosis
  for each row execute function public.set_updated_at();

drop trigger if exists trg_assessment_result_updated on public.assessment_result;
create trigger trg_assessment_result_updated
  before update on public.assessment_result
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS (SRS 5.3): registros clínicos de alta sensibilidad, sin delete.
-- ----------------------------------------------------------------------------
alter table public.diagnosis enable row level security;

drop policy if exists "diagnosis_select_clinical" on public.diagnosis;
create policy "diagnosis_select_clinical"
  on public.diagnosis for select to authenticated
  using (
    professional_id = auth.uid()
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "diagnosis_insert_professional" on public.diagnosis;
create policy "diagnosis_insert_professional"
  on public.diagnosis for insert to authenticated
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

drop policy if exists "diagnosis_update_professional" on public.diagnosis;
create policy "diagnosis_update_professional"
  on public.diagnosis for update to authenticated
  using (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  )
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

alter table public.assessment_result enable row level security;

drop policy if exists "assessment_result_select_clinical" on public.assessment_result;
create policy "assessment_result_select_clinical"
  on public.assessment_result for select to authenticated
  using (
    professional_id = auth.uid()
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "assessment_result_insert_professional" on public.assessment_result;
create policy "assessment_result_insert_professional"
  on public.assessment_result for insert to authenticated
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

drop policy if exists "assessment_result_update_professional" on public.assessment_result;
create policy "assessment_result_update_professional"
  on public.assessment_result for update to authenticated
  using (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  )
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

-- ----------------------------------------------------------------------------
-- Auditoría de cambios (RF-SaaS10 / 6.7)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_audit_diagnosis on public.diagnosis;
create trigger trg_audit_diagnosis
  after insert or update or delete on public.diagnosis
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_assessment_result on public.assessment_result;
create trigger trg_audit_assessment_result
  after insert or update or delete on public.assessment_result
  for each row execute function public.log_audit();