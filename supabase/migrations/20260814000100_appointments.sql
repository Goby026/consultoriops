-- ============================================================================
-- ConsultorioPS - Fase 4: Citas y Agenda (RF14-RF18)
-- ============================================================================
-- Tabla appointment, trigger de validación (RN01, RN02, RN08), RPC de
-- disponibilidad (get_availability), políticas RLS y auditoría. Idempotente.
-- Estados RN03: PROGRAMADA, CANCELADA, ATENDIDA, REPROGRAMADA, NO_ASISTIO.
-- Asistencia RF18: PRESENT (asistió), LATE (tardanza), ABSENT (no asistió).
-- Convención day_of_week: 0=Domingo ... 6=Sábado (compatible con JS Date).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. appointment
-- ----------------------------------------------------------------------------
create table if not exists public.appointment (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenant(id) on delete cascade,
  patient_id       uuid not null references public.patient(id) on delete cascade,
  professional_id  uuid not null references auth.users(id) on delete cascade,
  service_id       uuid not null references public.service(id) on delete cascade,
  scheduled_at     timestamptz not null,
  duration_minutes int not null default 0 check (duration_minutes >= 0),
  price            numeric(10,2) not null default 0,
  status           text not null default 'PROGRAMADA'
                   check (status in ('PROGRAMADA','CANCELADA','ATENDIDA','REPROGRAMADA','NO_ASISTIO')),
  attendance       text check (attendance in ('PRESENT','LATE','ABSENT')),
  notes            text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_appointment_tenant on public.appointment (tenant_id);
create index if not exists idx_appointment_prof_date on public.appointment (professional_id, scheduled_at);
create index if not exists idx_appointment_patient on public.appointment (patient_id);
create index if not exists idx_appointment_status on public.appointment (status);

drop trigger if exists trg_appointment_updated on public.appointment;
create trigger trg_appointment_updated
  before update on public.appointment
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Trigger de validación de citas (RN01, RN02, RN03, RN08)
--    - snapshot de duración/precio del servicio al crear (RF-CON10)
--    - profesional con membresía clínica activa
--    - solapamiento de horario con citas ocupadas
--    - máximo de citas por día por profesional/servicio (RF12/RN02)
--    - transiciones de estado y prohibición de reprogramar canceladas (RN08)
-- ----------------------------------------------------------------------------
create or replace function public.validate_appointment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_duration    int;
  v_service_max int;
  v_price       numeric(10,2);
  v_tz          text;
begin
  -- El profesional debe tener membresía activa con rol clínico en el consultorio.
  if not exists (
    select 1
    from public.tenant_membership tm
    join public.role r on r.id = tm.role_id
    where tm.tenant_id = new.tenant_id
      and tm.user_id = new.professional_id
      and tm.status = 'active'
      and r.code in ('professional', 'tenant_admin')
  ) then
    raise exception 'El profesional no tiene una membresía activa en este consultorio';
  end if;

  -- El paciente debe pertenecer al consultorio (RN01).
  if not exists (
    select 1 from public.patient p
    where p.id = new.patient_id and p.tenant_id = new.tenant_id
  ) then
    raise exception 'El paciente no pertenece al consultorio';
  end if;

  -- El servicio debe pertenecer al consultorio.
  select duration_minutes, max_appointments_per_day, price
    into v_duration, v_service_max, v_price
    from public.service
    where id = new.service_id and tenant_id = new.tenant_id;
  if v_duration is null then
    raise exception 'El servicio no pertenece al consultorio';
  end if;

  if tg_op = 'INSERT' then
    -- Fotografía histórica del servicio (RF-CON10).
    new.duration_minutes := v_duration;
    new.price := v_price;
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
  else
    v_duration := coalesce(new.duration_minutes, old.duration_minutes);
  end if;

  if new.status is null then
    new.status := 'PROGRAMADA';
  end if;

  -- RN08: una cita cancelada es inmutable.
  if tg_op = 'UPDATE' and old.status = 'CANCELADA' then
    if new.status <> 'CANCELADA' then
      raise exception 'No se puede reprogramar una cita cancelada';
    end if;
    if new.scheduled_at is distinct from old.scheduled_at then
      raise exception 'No se puede modificar una cita cancelada';
    end if;
  end if;

  -- Solo se reprograma una cita en estado PROGRAMADA/REPROGRAMADA.
  if tg_op = 'UPDATE'
     and new.scheduled_at is distinct from old.scheduled_at
     and old.status not in ('PROGRAMADA', 'REPROGRAMADA') then
    raise exception 'Solo se puede reprogramar una cita programada';
  end if;

  -- Solapamiento y límite diario solo para estados que ocupan agenda.
  if new.status in ('PROGRAMADA', 'REPROGRAMADA') then
    if exists (
      select 1 from public.appointment a
      where a.tenant_id = new.tenant_id
        and a.professional_id = new.professional_id
        and a.status in ('PROGRAMADA', 'REPROGRAMADA')
        and a.id is distinct from new.id
        and a.scheduled_at < (new.scheduled_at + make_interval(mins => v_duration))
        and new.scheduled_at < (a.scheduled_at + make_interval(mins => a.duration_minutes))
    ) then
      raise exception 'El horario elegido se solapa con otra cita de este profesional';
    end if;

    -- RF12/RN02: máximo de citas por día por profesional (por servicio).
    if v_service_max > 0 then
      select coalesce(timezone, 'America/Lima') into v_tz
        from public.tenant_settings where tenant_id = new.tenant_id;
      if (
        select count(*)
        from public.appointment a
        where a.tenant_id = new.tenant_id
          and a.professional_id = new.professional_id
          and a.service_id = new.service_id
          and a.status in ('PROGRAMADA', 'REPROGRAMADA', 'ATENDIDA')
          and a.id is distinct from new.id
          and (a.scheduled_at AT TIME ZONE v_tz)::date
              = (new.scheduled_at AT TIME ZONE v_tz)::date
      ) >= v_service_max then
        raise exception 'Se alcanzó el máximo de % citas por día para este servicio', v_service_max;
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointment_validate on public.appointment;
create trigger trg_appointment_validate
  before insert or update on public.appointment
  for each row execute function public.validate_appointment();

-- ----------------------------------------------------------------------------
-- 3. RPC get_availability (RF17): slots libres por profesional/fecha/servicio
--    Respeta horario del profesional y del consultorio, descansos,
--    excepciones y citas ocupadas. Si el usuario está autenticado exige
--    membresía; en contexto privilegiado (db query / service role) no.
-- ----------------------------------------------------------------------------
create or replace function public.get_availability(
  p_tenant_id       uuid,
  p_professional_id uuid,
  p_date            date,
  p_service_id      uuid
)
returns table (slot_start timestamptz, slot_end timestamptz)
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_tz        text;
  v_duration  int;
  v_max       int;
  v_today     date;
  v_now_min   int;
  v_min       int;
begin
  if auth.uid() is not null and not public.is_tenant_member(p_tenant_id) then
    raise exception 'No autorizado';
  end if;

  select coalesce(timezone, 'America/Lima') into v_tz
    from public.tenant_settings where tenant_id = p_tenant_id;

  select duration_minutes, max_appointments_per_day
    into v_duration, v_max
    from public.service
    where id = p_service_id and tenant_id = p_tenant_id;
  if v_duration is null or v_duration <= 0 then
    raise exception 'El servicio no existe o no pertenece al consultorio';
  end if;

  -- RF12/RN02: agotar disponibilidad cuando se alcanza el máximo diario.
  if v_max > 0 then
    if (
      select count(*)
      from public.appointment a
      where a.tenant_id = p_tenant_id
        and a.professional_id = p_professional_id
        and a.service_id = p_service_id
        and a.status in ('PROGRAMADA', 'REPROGRAMADA', 'ATENDIDA')
        and (a.scheduled_at AT TIME ZONE v_tz)::date = p_date
    ) >= v_max then
      return;
    end if;
  end if;

  create temp table base_min (m int primary key) on commit drop;
  create temp table busy_min (m int primary key) on commit drop;

  -- base: bloques de trabajo del profesional intersección con el horario
  -- general del consultorio (si el consultorio definió horario ese día).
  insert into base_min
  select s.m
  from generate_series(0, 1439) s(m)
  where exists (
    select 1 from public.professional_schedule ps
    where ps.tenant_id = p_tenant_id
      and ps.professional_id = p_professional_id
      and ps.day_of_week = extract(dow from p_date)::int
      and ps.kind = 'WORK'
      and ps.active
      and extract(epoch from ps.start_time)/60 <= s.m
      and s.m < extract(epoch from ps.end_time)/60
  )
  and (
    not exists (
      select 1 from public.clinic_schedule cs
      where cs.tenant_id = p_tenant_id
        and cs.day_of_week = extract(dow from p_date)::int
        and cs.active
    )
    or exists (
      select 1 from public.clinic_schedule cs
      where cs.tenant_id = p_tenant_id
        and cs.day_of_week = extract(dow from p_date)::int
        and cs.active
        and extract(epoch from cs.start_time)/60 <= s.m
        and s.m < extract(epoch from cs.end_time)/60
    )
  );

  -- busy: descansos del profesional.
  insert into busy_min
  select s.m
  from generate_series(0, 1439) s(m)
  where exists (
    select 1 from public.professional_schedule br
    where br.tenant_id = p_tenant_id
      and br.professional_id = p_professional_id
      and br.day_of_week = extract(dow from p_date)::int
      and br.kind = 'BREAK'
      and br.active
      and extract(epoch from br.start_time)/60 <= s.m
      and s.m < extract(epoch from br.end_time)/60
  );

  -- busy: excepciones bloqueadas (propias o de todo el consultorio).
  insert into busy_min
  select s.m
  from generate_series(0, 1439) s(m)
  where exists (
    select 1 from public.schedule_exception ex
    where ex.tenant_id = p_tenant_id
      and ex.date = p_date
      and ex.kind in ('BLOCKED', 'VACATION', 'HOLIDAY')
      and (ex.professional_id is null or ex.professional_id = p_professional_id)
      and extract(epoch from ex.start_time)/60 <= s.m
      and s.m < extract(epoch from ex.end_time)/60
  );

  -- base adicional: excepciones tipo OVERRIDE (habilita horas extra).
  insert into base_min
  select s.m
  from generate_series(0, 1439) s(m)
  where exists (
    select 1 from public.schedule_exception ex
    where ex.tenant_id = p_tenant_id
      and ex.date = p_date
      and ex.kind = 'OVERRIDE'
      and (ex.professional_id is null or ex.professional_id = p_professional_id)
      and extract(epoch from ex.start_time)/60 <= s.m
      and s.m < extract(epoch from ex.end_time)/60
  );

  -- busy: citas ya ocupadas del día.
  insert into busy_min
  select distinct floor(extract(epoch from (a.scheduled_at AT TIME ZONE v_tz)::time)/60)::int + g.m
  from public.appointment a
  cross join lateral generate_series(0, greatest(a.duration_minutes, 1) - 1) g(m)
  where a.tenant_id = p_tenant_id
    and a.professional_id = p_professional_id
    and a.status in ('PROGRAMADA', 'REPROGRAMADA')
    and (a.scheduled_at AT TIME ZONE v_tz)::date = p_date
    and a.duration_minutes > 0;

  v_today   := (now() AT TIME ZONE v_tz)::date;
  v_now_min := floor(extract(epoch from (now() AT TIME ZONE v_tz)::time)/60)::int;

  -- Generación de slots cada 30 minutos.
  for v_min in 0 .. (1439 - v_duration) by 30 loop
    if p_date = v_today and v_min < v_now_min then
      continue;
    end if;
    if not exists (
      select 1
      from generate_series(v_min, v_min + v_duration - 1) t(x)
      where not exists (select 1 from base_min b where b.m = t.x)
         or exists (select 1 from busy_min b where b.m = t.x)
    ) then
      slot_start := (p_date::timestamp + make_interval(mins => v_min)) AT TIME ZONE v_tz;
      slot_end   := slot_start + make_interval(mins => v_duration);
      return next;
    end if;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. RLS de appointment
--    Select: miembros activos del tenant.
--    Insert/Update: staff (admin, profesional, recepcionista). Sin delete.
-- ----------------------------------------------------------------------------
alter table public.appointment enable row level security;

drop policy if exists "appointment_select_member" on public.appointment;
create policy "appointment_select_member"
  on public.appointment for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "appointment_insert_staff" on public.appointment;
create policy "appointment_insert_staff"
  on public.appointment for insert to authenticated
  with check (
    public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist'])
  );

drop policy if exists "appointment_update_staff" on public.appointment;
create policy "appointment_update_staff"
  on public.appointment for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

-- ----------------------------------------------------------------------------
-- 5. Auditoría (RF-SaaS10)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_audit_appointment on public.appointment;
create trigger trg_audit_appointment
  after insert or update or delete on public.appointment
  for each row execute function public.log_audit();
