-- ============================================================================
-- ConsultorioPS - Fase 5: Atención Clínica - Plan de Tratamiento (RF23)
-- ============================================================================
-- RF23: registrar plan de tratamiento con objetivos terapéuticos medibles y
-- frecuencia sugerida. Es un registro clínico a nivel de paciente (abarca varias
-- sesiones), con estado activo/completado/cancelado y sin delete (SRS 5.3).
-- RLS: registro y edición solo profesional dueño; lectura profesional dueño +
-- administrador auditado (RN06, RN13). Idempotente.
-- ============================================================================

create table if not exists public.treatment_plan (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  patient_id         uuid not null references public.patient(id) on delete cascade,
  professional_id    uuid not null references auth.users(id) on delete cascade,
  status             text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  objectives         text not null,
  suggested_frequency text,
  duration_weeks     integer check (duration_weeks is null or duration_weeks > 0),
  starts_on          date not null default current_date,
  ends_on            date,
  notes              text,
  created_by         uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists idx_treatment_plan_tenant on public.treatment_plan (tenant_id);
create index if not exists idx_treatment_plan_patient on public.treatment_plan (patient_id);
create index if not exists idx_treatment_plan_professional on public.treatment_plan (professional_id);

drop trigger if exists trg_treatment_plan_updated on public.treatment_plan;
create trigger trg_treatment_plan_updated
  before update on public.treatment_plan
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- RLS (SRS 5.3): registro clínico de alta sensibilidad, sin delete.
-- ----------------------------------------------------------------------------
alter table public.treatment_plan enable row level security;

drop policy if exists "treatment_plan_select_clinical" on public.treatment_plan;
create policy "treatment_plan_select_clinical"
  on public.treatment_plan for select to authenticated
  using (
    professional_id = auth.uid()
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "treatment_plan_insert_professional" on public.treatment_plan;
create policy "treatment_plan_insert_professional"
  on public.treatment_plan for insert to authenticated
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

drop policy if exists "treatment_plan_update_professional" on public.treatment_plan;
create policy "treatment_plan_update_professional"
  on public.treatment_plan for update to authenticated
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
drop trigger if exists trg_audit_treatment_plan on public.treatment_plan;
create trigger trg_audit_treatment_plan
  after insert or update or delete on public.treatment_plan
  for each row execute function public.log_audit();
