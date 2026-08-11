-- ============================================================================
-- ConsultorioPS - Fase 5: Atención Clínica - Sesiones (RF19-RF21)
-- ============================================================================
-- Tablas: session, anamnesis, progress_note (SOAP).
-- - RF19: registrar sesión asociada a una cita ATENDIDA (RN04), una sesión
--   pertenece a una única cita (RN05), solo el rol profesional (RN06).
-- - RN09: no se puede registrar la primera sesión sin consentimiento informado
--   vigente firmado (validado en trigger y en edge function).
-- - RF20: anamnesis estructurada (motivo de consulta, antecedentes personales,
--   antecedentes familiares, historia del problema, factores de riesgo).
-- - RF21: nota de evolución SOAP (Subjetivo, Objetivo, Análisis, Plan).
-- - Sensibilidad alta (SRS 5.3): acceso solo profesional dueño de la sesión y
--   administrador auditado (RN13). Sin delete.
-- - Columnas signed_at/signed_by en progress_note preparadas para RF25 (firma);
--   la inmutabilidad de nota firmada (RN10) se activará en ese hito.
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. session
-- ----------------------------------------------------------------------------
create table if not exists public.session (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  appointment_id   uuid not null references public.appointment(id) on delete cascade,
  patient_id       uuid not null references public.patient(id) on delete cascade,
  professional_id  uuid not null references auth.users(id) on delete cascade,
  status           text not null default 'open' check (status in ('open', 'completed')),
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  created_by       uuid references auth.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists idx_session_tenant on public.session (tenant_id);
create index if not exists idx_session_patient on public.session (patient_id);
create index if not exists idx_session_professional on public.session (professional_id);

drop trigger if exists trg_session_updated on public.session;
create trigger trg_session_updated
  before update on public.session
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. anamnesis (RF20) - 1:1 con session
-- ----------------------------------------------------------------------------
create table if not exists public.anamnesis (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenant(id) on delete cascade,
  session_id               uuid not null references public.session(id) on delete cascade,
  patient_id               uuid not null references public.patient(id) on delete cascade,
  reason_for_consultation  text not null,
  personal_background      text,
  family_background        text,
  problem_history          text,
  risk_assessment          text,
  created_by               uuid references auth.users(id) on delete set null default auth.uid(),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  unique (session_id)
);

create index if not exists idx_anamnesis_tenant on public.anamnesis (tenant_id);
create index if not exists idx_anamnesis_session on public.anamnesis (session_id);

drop trigger if exists trg_anamnesis_updated on public.anamnesis;
create trigger trg_anamnesis_updated
  before update on public.anamnesis
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. progress_note (RF21 - SOAP)
-- ----------------------------------------------------------------------------
create table if not exists public.progress_note (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  session_id  uuid not null references public.session(id) on delete cascade,
  patient_id  uuid not null references public.patient(id) on delete cascade,
  subjective  text not null,
  objective   text not null,
  analysis    text not null,
  plan        text not null,
  signed_at   timestamptz,
  signed_by   uuid references auth.users(id) on delete set null,
  created_by  uuid references auth.users(id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_progress_note_tenant on public.progress_note (tenant_id);
create index if not exists idx_progress_note_session on public.progress_note (session_id);

drop trigger if exists trg_progress_note_updated on public.progress_note;
create trigger trg_progress_note_updated
  before update on public.progress_note
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Trigger validate_session (RN04, RN05, RN06, RN09)
--    Insert como security definer: se ejecuta para cualquier vía (SDK o edge).
-- ----------------------------------------------------------------------------
create or replace function public.validate_session()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_status       text;
  v_appt_prof    uuid;
  v_appt_patient uuid;
begin
  -- RN06: solo el rol profesional puede registrar sesiones clínicas.
  if not exists (
    select 1
    from public.tenant_membership tm
    join public.role r on r.id = tm.role_id
    where tm.tenant_id = new.tenant_id
      and tm.user_id = auth.uid()
      and tm.status = 'active'
      and (tm.valid_from is null or tm.valid_from <= now())
      and (tm.valid_to is null or tm.valid_to >= now())
      and r.code = 'professional'
  ) then
    raise exception 'Solo el rol profesional puede registrar sesiones clínicas';
  end if;

  -- El profesional dueño es quien ejecuta el insert (RN06).
  if auth.uid() is distinct from new.professional_id then
    raise exception 'Solo el profesional de la cita puede registrar la sesión';
  end if;

  -- RN04: la cita debe estar ATENDIDA y pertenecer al consultorio.
  select a.status, a.professional_id, a.patient_id
    into v_status, v_appt_prof, v_appt_patient
    from public.appointment a
    where a.id = new.appointment_id and a.tenant_id = new.tenant_id;
  if v_status is null then
    raise exception 'La cita no pertenece a este consultorio';
  end if;
  if v_status <> 'ATENDIDA' then
    raise exception 'Solo citas en estado ATENDIDA pueden generar sesiones';
  end if;
  if v_appt_prof is distinct from new.professional_id then
    raise exception 'El profesional no coincide con la cita';
  end if;
  if v_appt_patient is distinct from new.patient_id then
    raise exception 'El paciente no coincide con la cita';
  end if;

  -- RN05: una sesión pertenece a una única cita.
  if exists (
    select 1 from public.session s
    where s.tenant_id = new.tenant_id and s.appointment_id = new.appointment_id
  ) then
    raise exception 'Esta cita ya tiene una sesión registrada';
  end if;

  -- RN09: la primera sesión del paciente exige consentimiento informado vigente.
  if not exists (
    select 1 from public.session s
    where s.tenant_id = new.tenant_id and s.patient_id = new.patient_id
  ) then
    if not exists (
      select 1 from public.informed_consent ic
      where ic.tenant_id = new.tenant_id
        and ic.patient_id = new.patient_id
        and ic.status = 'accepted'
        and (ic.valid_until is null or ic.valid_until >= now())
    ) then
      raise exception 'No se puede registrar la primera sesión del paciente sin consentimiento informado vigente';
    end if;
  end if;

  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_session_validate on public.session;
create trigger trg_session_validate
  before insert on public.session
  for each row execute function public.validate_session();

-- ----------------------------------------------------------------------------
-- 5. RPC get_pending_session_appointments (RF19)
--    Citas ATENDIDA que aún no tienen sesión. Profesional ve las propias;
--    administrador y contexto privilegiado ven todas.
-- ----------------------------------------------------------------------------
create or replace function public.get_pending_session_appointments(p_tenant_id uuid)
returns table (
  id                 uuid,
  patient_id         uuid,
  professional_id    uuid,
  service_id         uuid,
  scheduled_at       timestamptz,
  status             text,
  attendance         text,
  patient_first_name text,
  patient_last_name  text,
  service_name       text
)
language plpgsql volatile security definer set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_tenant_member(p_tenant_id) then
    raise exception 'No autorizado';
  end if;

  return query
  select a.id, a.patient_id, a.professional_id, a.service_id, a.scheduled_at,
         a.status, a.attendance, p.first_name, p.last_name, s.name
  from public.appointment a
  join public.patient p on p.id = a.patient_id
  join public.service s on s.id = a.service_id
  where a.tenant_id = p_tenant_id
    and a.status = 'ATENDIDA'
    and not exists (
      select 1 from public.session ss where ss.appointment_id = a.id
    )
    and (
      auth.uid() is null
      or public.has_role_in_tenant(p_tenant_id, array['tenant_admin'])
      or a.professional_id = auth.uid()
    )
  order by a.scheduled_at desc
  limit 200;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS
--    Sensibilidad alta (SRS 5.3): lectura solo profesional dueño + admin
--    auditado. Registro solo profesional dueño. Sin delete (registro clínico).
-- ----------------------------------------------------------------------------

-- session -------------------------------------------------------------------
alter table public.session enable row level security;

drop policy if exists "session_select_clinical" on public.session;
create policy "session_select_clinical"
  on public.session for select to authenticated
  using (
    professional_id = auth.uid()
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "session_insert_professional" on public.session;
create policy "session_insert_professional"
  on public.session for insert to authenticated
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

drop policy if exists "session_update_professional" on public.session;
create policy "session_update_professional"
  on public.session for update to authenticated
  using (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  )
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

-- anamnesis ----------------------------------------------------------------
alter table public.anamnesis enable row level security;

drop policy if exists "anamnesis_select_clinical" on public.anamnesis;
create policy "anamnesis_select_clinical"
  on public.anamnesis for select to authenticated
  using (
    exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "anamnesis_insert_professional" on public.anamnesis;
create policy "anamnesis_insert_professional"
  on public.anamnesis for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
  );

drop policy if exists "anamnesis_update_professional" on public.anamnesis;
create policy "anamnesis_update_professional"
  on public.anamnesis for update to authenticated
  using (
    exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
  );

-- progress_note ------------------------------------------------------------
alter table public.progress_note enable row level security;

drop policy if exists "progress_note_select_clinical" on public.progress_note;
create policy "progress_note_select_clinical"
  on public.progress_note for select to authenticated
  using (
    exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "progress_note_insert_professional" on public.progress_note;
create policy "progress_note_insert_professional"
  on public.progress_note for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
  );

drop policy if exists "progress_note_update_professional" on public.progress_note;
create policy "progress_note_update_professional"
  on public.progress_note for update to authenticated
  using (
    exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.session s
      where s.id = session_id and s.tenant_id = tenant_id and s.professional_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Auditoría de cambios (RF-SaaS10 / 6.7)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_audit_session on public.session;
create trigger trg_audit_session
  after insert or update or delete on public.session
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_anamnesis on public.anamnesis;
create trigger trg_audit_anamnesis
  after insert or update or delete on public.anamnesis
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_progress_note on public.progress_note;
create trigger trg_audit_progress_note
  after insert or update or delete on public.progress_note
  for each row execute function public.log_audit();
