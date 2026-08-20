-- ============================================================================
-- ConsultorioPS - Fase 5: Atención Clínica - Firma, Adenda y Alertas (RF25-RF27)
-- ============================================================================
-- RF25: firmar digitalmente una nota clínica; una nota firmada es inmutable
--       (RN10). signed_at/signed_by ya existían; se activa la protección.
-- RF26: adenda a una nota firmada (no edición directa), preservando el
--       registro original. La adenda es una nueva nota enlazada (addendum_of).
-- RF27: alerta de riesgo cuando el profesional marca una sesión con riesgo
--       alto (ideación suicida, autolesión activa, riesgo a terceros).
--       Visible solo para Administrador y el propio profesional (RLS).
-- Registros clínicos de alta sensibilidad (SRS 5.3): sin delete.
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. RF25/RF26 · progress_note: inmutabilidad de nota firmada + adenda
-- ----------------------------------------------------------------------------
alter table public.progress_note add column if not exists addendum_of uuid references public.progress_note(id) on delete set null;

create index if not exists idx_progress_note_addendum on public.progress_note (addendum_of);

alter table public.progress_note
  drop constraint if exists progress_note_no_self_addendum;
alter table public.progress_note
  add constraint progress_note_no_self_addendum check (addendum_of is null or addendum_of <> id);

create or replace function public.protect_signed_note()
returns trigger
language plpgsql
as $$
begin
  -- RN10: una nota firmada es inmutable. La firma en sí es el update que
  -- establece signed_at/signed_by (old.signed_at es null en ese momento);
  -- cualquier update/delete posterior queda bloqueado. Se permite el delete
  -- en cascada (pg_trigger_depth() > 0) para no impedir la eliminación de un
  -- expediente completo (p. ej. borrado de paciente/consultorio).
  if TG_OP = 'DELETE' and old.signed_at is not null and pg_trigger_depth() = 0 then
    raise exception 'Nota clínica firmada: no se permite modificar ni eliminar (RN10)';
  end if;
  if TG_OP = 'UPDATE' and old.signed_at is not null then
    raise exception 'Nota clínica firmada: no se permite modificar ni eliminar (RN10)';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_protect_signed_note on public.progress_note;
create trigger trg_protect_signed_note
  before update or delete on public.progress_note
  for each row execute function public.protect_signed_note();

-- ----------------------------------------------------------------------------
-- 2. RF27 · risk_alert
-- ----------------------------------------------------------------------------
create table if not exists public.risk_alert (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  patient_id      uuid not null references public.patient(id) on delete cascade,
  session_id      uuid references public.session(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  level           text not null check (level in ('alta', 'media', 'baja')),
  description     text,
  status          text not null default 'open' check (status in ('open', 'resolved')),
  resolved_at     timestamptz,
  resolved_by     uuid references auth.users(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null default auth.uid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_risk_alert_tenant on public.risk_alert (tenant_id);
create index if not exists idx_risk_alert_patient on public.risk_alert (patient_id);
create index if not exists idx_risk_alert_professional on public.risk_alert (professional_id);
create index if not exists idx_risk_alert_open on public.risk_alert (status, created_at);

drop trigger if exists trg_risk_alert_updated on public.risk_alert;
create trigger trg_risk_alert_updated
  before update on public.risk_alert
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS
--    RF27: visible solo para Administrador y el propio profesional; nunca
--    Recepcionista ni Paciente. Registro solo profesional dueño. Sin delete.
-- ----------------------------------------------------------------------------
alter table public.risk_alert enable row level security;

drop policy if exists "risk_alert_select_clinical" on public.risk_alert;
create policy "risk_alert_select_clinical"
  on public.risk_alert for select to authenticated
  using (
    (professional_id = auth.uid() and public.is_tenant_member(tenant_id))
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "risk_alert_insert_professional" on public.risk_alert;
create policy "risk_alert_insert_professional"
  on public.risk_alert for insert to authenticated
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

drop policy if exists "risk_alert_update_clinical" on public.risk_alert;
create policy "risk_alert_update_clinical"
  on public.risk_alert for update to authenticated
  using (
    (professional_id = auth.uid() and public.has_role_in_tenant(tenant_id, array['professional']))
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  )
  with check (
    (professional_id = auth.uid() and public.has_role_in_tenant(tenant_id, array['professional']))
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

-- ----------------------------------------------------------------------------
-- 4. Auditoría de cambios (RF-SaaS10 / 6.7)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_audit_risk_alert on public.risk_alert;
create trigger trg_audit_risk_alert
  after insert or update or delete on public.risk_alert
  for each row execute function public.log_audit();