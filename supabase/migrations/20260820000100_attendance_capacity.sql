-- ============================================================================
-- ConsultorioPS - Fase 6: Capacidad diaria por profesional, contención de
-- horario y control de asistencia en fecha (puntos 2 y 3 del plan).
-- ============================================================================
-- 1. tenant_membership.max_appointments_per_day: tope diario TOTAL de citas
--    por profesional (todas las citas del día, cualquier servicio). 0 = sin límite.
-- 2. validate_appointment: la cita debe iniciar dentro de un bloque WORK del
--    "Horario por profesional" (o un OVERRIDE), y el total diario del
--    profesional no puede superar su máximo configurado.
-- 3. validate_appointment: la asistencia/estado ATENDIDA/NO_ASISTIO solo puede
--    marcarse el día de la cita (o antes, por error de fecha, nunca futuro).
--    El administrador siempre puede corregir; el service role (edge) queda exento.
-- 4. get_availability: no ofrecer slots cuando el profesional alcanzó su tope
--    diario total.
-- Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Capacidad diaria por profesional
-- ----------------------------------------------------------------------------
alter table public.tenant_membership
  add column if not exists max_appointments_per_day int not null default 2
    check (max_appointments_per_day >= 0);

-- ----------------------------------------------------------------------------
-- 2. validate_appointment: contención de horario + tope total diario + gate
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
  v_prof_max    int;
  v_start_min   int;
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

  select coalesce(timezone, 'America/Lima') into v_tz
    from public.tenant_settings where tenant_id = new.tenant_id;
  if v_tz is null then
    v_tz := 'America/Lima';
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

  -- Solapamiento, contención de horario y límites diarios solo para estados
  -- que ocupan agenda.
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

    -- Contención de horario (RF-CON05/RF-CON06): la cita debe iniciar dentro de
    -- un bloque WORK del profesional (o un OVERRIDE) para ese día, de acuerdo al
    -- formulario "Horario por profesional".
    v_start_min := floor(extract(epoch from (new.scheduled_at AT TIME ZONE v_tz)::time) / 60)::int;
    if not exists (
      select 1
      from public.professional_schedule ps
      where ps.tenant_id = new.tenant_id
        and ps.professional_id = new.professional_id
        and ps.day_of_week = extract(dow from (new.scheduled_at AT TIME ZONE v_tz))::int
        and ps.kind = 'WORK'
        and ps.active
        and extract(epoch from ps.start_time) / 60 <= v_start_min
        and v_start_min < extract(epoch from ps.end_time) / 60
    )
    and not exists (
      select 1
      from public.schedule_exception ex
      where ex.tenant_id = new.tenant_id
        and ex.date = (new.scheduled_at AT TIME ZONE v_tz)::date
        and ex.kind = 'OVERRIDE'
        and (ex.professional_id is null or ex.professional_id = new.professional_id)
        and extract(epoch from ex.start_time) / 60 <= v_start_min
        and v_start_min < extract(epoch from ex.end_time) / 60
    ) then
      raise exception 'El horario elegido no coincide con el horario de atención del profesional';
    end if;

    -- RF12/RN02: tope diario TOTAL del profesional (todas las citas del día,
    -- cualquier servicio).
    select max_appointments_per_day into v_prof_max
      from public.tenant_membership tm
      where tm.tenant_id = new.tenant_id
        and tm.user_id = new.professional_id
        and tm.status = 'active';
    if coalesce(v_prof_max, 0) > 0 then
      if (
        select count(*)
        from public.appointment a
        where a.tenant_id = new.tenant_id
          and a.professional_id = new.professional_id
          and a.status in ('PROGRAMADA', 'REPROGRAMADA', 'ATENDIDA')
          and a.id is distinct from new.id
          and (a.scheduled_at AT TIME ZONE v_tz)::date
              = (new.scheduled_at AT TIME ZONE v_tz)::date
      ) >= v_prof_max then
        raise exception 'Se alcanzó el máximo de % citas por día para este profesional', v_prof_max;
      end if;
    end if;

    -- RF12/RN02: máximo de citas por día por profesional (por servicio).
    if v_service_max > 0 then
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

  -- RF14: la asistencia (y el pase a ATENDIDA/NO_ASISTIO) solo puede marcarse
  -- el día que corresponde (fecha futura bloqueada). El administrador siempre
  -- puede corregir; el service role (edge) queda exento.
  if tg_op = 'UPDATE'
     and auth.uid() is not null
     and not public.has_role_in_tenant(new.tenant_id, array['tenant_admin'])
     and (
       new.attendance is not null
       or (new.status in ('ATENDIDA', 'NO_ASISTIO') and old.status in ('PROGRAMADA', 'REPROGRAMADA'))
     )
     and (new.scheduled_at AT TIME ZONE v_tz)::date > (now() AT TIME ZONE v_tz)::date
  then
    raise exception 'La asistencia solo puede marcarse el día de la cita';
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. get_availability: agotar slots con el tope diario total del profesional
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
  v_prof_max  int;
  v_today     date;
  v_now_min   int;
  v_min       int;
begin
  if auth.uid() is not null and not public.is_tenant_member(p_tenant_id) then
    raise exception 'No autorizado';
  end if;

  select coalesce(timezone, 'America/Lima') into v_tz
    from public.tenant_settings where tenant_id = p_tenant_id;
  if v_tz is null then
    v_tz := 'America/Lima';
  end if;

  select duration_minutes, max_appointments_per_day
    into v_duration, v_max
    from public.service
    where id = p_service_id and tenant_id = p_tenant_id;
  if v_duration is null or v_duration <= 0 then
    raise exception 'El servicio no existe o no pertenece al consultorio';
  end if;

  -- RF12/RN02: agotar disponibilidad cuando se alcanza el máximo diario por servicio.
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

  -- RF12/RN02: agotar disponibilidad con el tope diario TOTAL del profesional.
  select max_appointments_per_day into v_prof_max
    from public.tenant_membership tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_professional_id
      and tm.status = 'active';
  if coalesce(v_prof_max, 0) > 0 then
    if (
      select count(*)
      from public.appointment a
      where a.tenant_id = p_tenant_id
        and a.professional_id = p_professional_id
        and a.status in ('PROGRAMADA', 'REPROGRAMADA', 'ATENDIDA')
        and (a.scheduled_at AT TIME ZONE v_tz)::date = p_date
    ) >= v_prof_max then
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