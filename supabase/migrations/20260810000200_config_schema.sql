-- ============================================================================
-- ConsultorioPS - Fase 2: Configuración del Consultorio
-- ============================================================================
-- Servicios, historial de precios, horario del consultorio, horarios por
-- profesional, excepciones de agenda, gestión de membresías por tenant_admin
-- y políticas RLS. Idempotente.
-- Convención day_of_week: 0=Domingo ... 6=Sábado (compatible con JS Date).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. service
-- ----------------------------------------------------------------------------
create table if not exists public.service (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenant(id) on delete cascade,
  name                     text not null,
  description              text,
  duration_minutes         int not null default 50 check (duration_minutes > 0),
  modality                 text not null default 'PRESENCIAL'
                           check (modality in ('PRESENCIAL', 'ONLINE', 'HIBRIDO')),
  price                    numeric(10,2) not null default 0,
  max_appointments_per_day int not null default 0 check (max_appointments_per_day >= 0),
  active                   boolean not null default true,
  sort_order               int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists idx_service_tenant on public.service (tenant_id);

drop trigger if exists trg_service_updated on public.service;
create trigger trg_service_updated
  before update on public.service
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. service_price (historial de precios - RF-CON10)
-- ----------------------------------------------------------------------------
create table if not exists public.service_price (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenant(id) on delete cascade,
  service_id uuid not null references public.service(id) on delete cascade,
  price      numeric(10,2) not null,
  valid_from timestamptz not null default now(),
  valid_to   timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_price_service on public.service_price (service_id);

-- Snapshot automático: al crear el servicio y en cada cambio de precio,
-- cierra el registro vigente y abre uno nuevo.
create or replace function public.snapshot_service_price()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.service_price
    set valid_to = now()
    where service_id = new.id and valid_to is null;
  insert into public.service_price (tenant_id, service_id, price)
  values (new.tenant_id, new.id, new.price);
  return new;
end;
$$;

drop trigger if exists trg_service_price_snapshot on public.service;
create trigger trg_service_price_snapshot
  after insert or update of price on public.service
  for each row execute function public.snapshot_service_price();

-- ----------------------------------------------------------------------------
-- 3. clinic_schedule (horario general del consultorio)
-- ----------------------------------------------------------------------------
create table if not exists public.clinic_schedule (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time  time not null,
  end_time    time not null check (end_time > start_time),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists idx_clinic_schedule_tenant on public.clinic_schedule (tenant_id);

create or replace function public.validate_clinic_schedule_overlap()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.clinic_schedule s
    where s.tenant_id = new.tenant_id
      and s.day_of_week = new.day_of_week
      and s.active
      and s.id <> new.id
      and s.start_time < new.end_time and new.start_time < s.end_time
  ) then
    raise exception 'El bloque se solapa con otro bloque del horario del consultorio';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clinic_schedule_overlap on public.clinic_schedule;
create trigger trg_clinic_schedule_overlap
  before insert or update on public.clinic_schedule
  for each row execute function public.validate_clinic_schedule_overlap();

-- ----------------------------------------------------------------------------
-- 4. professional_schedule (horario del profesional)
-- ----------------------------------------------------------------------------
create table if not exists public.professional_schedule (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  professional_id uuid not null references auth.users(id) on delete cascade,
  day_of_week     int not null check (day_of_week between 0 and 6),
  start_time      time not null,
  end_time        time not null check (end_time > start_time),
  kind            text not null default 'WORK' check (kind in ('WORK', 'BREAK')),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_prof_schedule_tenant on public.professional_schedule (tenant_id);
create index if not exists idx_prof_schedule_prof on public.professional_schedule (professional_id);

drop trigger if exists trg_prof_schedule_updated on public.professional_schedule;
create trigger trg_prof_schedule_updated
  before update on public.professional_schedule
  for each row execute function public.set_updated_at();

create or replace function public.validate_professional_schedule()
returns trigger
language plpgsql security definer set search_path = public
as $$
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
    raise exception 'El usuario no tiene una membresía activa como profesional en este consultorio';
  end if;

  -- Solapamiento de bloques de trabajo.
  if new.kind = 'WORK' and exists (
    select 1 from public.professional_schedule s
    where s.tenant_id = new.tenant_id
      and s.professional_id = new.professional_id
      and s.day_of_week = new.day_of_week
      and s.kind = 'WORK'
      and s.active
      and s.id <> new.id
      and s.start_time < new.end_time and new.start_time < s.end_time
  ) then
    raise exception 'El bloque de trabajo se solapa con otro bloque del mismo profesional';
  end if;

  -- Solapamiento de descansos entre sí.
  if new.kind = 'BREAK' and exists (
    select 1 from public.professional_schedule s
    where s.tenant_id = new.tenant_id
      and s.professional_id = new.professional_id
      and s.day_of_week = new.day_of_week
      and s.kind = 'BREAK'
      and s.active
      and s.id <> new.id
      and s.start_time < new.end_time and new.start_time < s.end_time
  ) then
    raise exception 'El descanso se solapa con otro descanso del mismo profesional';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prof_schedule_overlap on public.professional_schedule;
create trigger trg_prof_schedule_overlap
  before insert or update on public.professional_schedule
  for each row execute function public.validate_professional_schedule();

-- ----------------------------------------------------------------------------
-- 5. schedule_exception (vacaciones, feriados, bloqueos)
-- ----------------------------------------------------------------------------
create table if not exists public.schedule_exception (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenant(id) on delete cascade,
  professional_id uuid references auth.users(id) on delete cascade,
  date            date not null,
  start_time      time not null,
  end_time        time not null check (end_time > start_time),
  kind            text not null default 'BLOCKED'
                  check (kind in ('BLOCKED', 'VACATION', 'HOLIDAY', 'OVERRIDE')),
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_schedule_exception_tenant on public.schedule_exception (tenant_id);
create index if not exists idx_schedule_exception_date on public.schedule_exception (tenant_id, date);

create or replace function public.validate_schedule_exception()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- professional_id null = aplica a todo el consultorio.
  if exists (
    select 1 from public.schedule_exception s
    where s.tenant_id = new.tenant_id
      and s.date = new.date
      and s.professional_id is not distinct from new.professional_id
      and s.id <> new.id
      and s.start_time < new.end_time and new.start_time < s.end_time
  ) then
    raise exception 'La excepción se solapa con otra excepción del mismo día';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_schedule_exception_overlap on public.schedule_exception;
create trigger trg_schedule_exception_overlap
  before insert or update on public.schedule_exception
  for each row execute function public.validate_schedule_exception();

-- ----------------------------------------------------------------------------
-- 6. Gestión de membresías por tenant_admin (RF-SaaS05, RF-CON02)
-- ----------------------------------------------------------------------------
-- El tenant_admin gestiona su propio consultorio pero no puede asignar
-- roles de alcance plataforma.

drop policy if exists "tenant_membership_insert_tenant_admin" on public.tenant_membership;
create policy "tenant_membership_insert_tenant_admin"
  on public.tenant_membership for insert to authenticated
  with check (
    public.has_role_in_tenant(tenant_id, array['tenant_admin'])
    and exists (select 1 from public.role r where r.id = role_id and not r.platform_scope)
  );

drop policy if exists "tenant_membership_update_tenant_admin" on public.tenant_membership;
create policy "tenant_membership_update_tenant_admin"
  on public.tenant_membership for update to authenticated
  using (
    public.has_role_in_tenant(tenant_id, array['tenant_admin'])
    and exists (select 1 from public.role r where r.id = role_id and not r.platform_scope)
  )
  with check (
    public.has_role_in_tenant(tenant_id, array['tenant_admin'])
    and exists (select 1 from public.role r where r.id = role_id and not r.platform_scope)
  );

drop policy if exists "tenant_membership_delete_tenant_admin" on public.tenant_membership;
create policy "tenant_membership_delete_tenant_admin"
  on public.tenant_membership for delete to authenticated
  using (
    public.has_role_in_tenant(tenant_id, array['tenant_admin'])
    and exists (select 1 from public.role r where r.id = role_id and not r.platform_scope)
  );

-- ----------------------------------------------------------------------------
-- 7. user_profile: staff del mismo consultorio puede verse entre sí
-- ----------------------------------------------------------------------------
drop policy if exists "user_profile_select_shared_tenant" on public.user_profile;
create policy "user_profile_select_shared_tenant"
  on public.user_profile for select to authenticated
  using (
    exists (
      select 1
      from public.tenant_membership mine
      join public.tenant_membership theirs
        on theirs.tenant_id = mine.tenant_id and theirs.user_id = user_profile.id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.status = 'active'
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Búsqueda de usuario por email para alta de profesionales (RPC)
-- ----------------------------------------------------------------------------
create or replace function public.lookup_user_by_email(p_email text)
returns table (user_id uuid, email text, full_name text)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_platform_admin() and not exists (
    select 1 from public.tenant_membership tm
    join public.role r on r.id = tm.role_id
    where tm.user_id = auth.uid()
      and tm.status = 'active'
      and r.code = 'tenant_admin'
  ) then
    raise exception 'No autorizado';
  end if;

  return query
    select up.id, up.email, up.full_name
    from public.user_profile up
    where lower(up.email) = lower(p_email)
    limit 1;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. RLS de las tablas de configuración
-- ----------------------------------------------------------------------------
-- Lectura: cualquier miembro activo del tenant.
-- Escritura: solo Administrador de Consultorio del tenant.

-- service ----------------------------------------------------------------
alter table public.service enable row level security;

drop policy if exists "service_select_member" on public.service;
create policy "service_select_member"
  on public.service for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "service_insert_tenant_admin" on public.service;
create policy "service_insert_tenant_admin"
  on public.service for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "service_update_tenant_admin" on public.service;
create policy "service_update_tenant_admin"
  on public.service for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "service_delete_tenant_admin" on public.service;
create policy "service_delete_tenant_admin"
  on public.service for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- service_price ----------------------------------------------------------
alter table public.service_price enable row level security;

drop policy if exists "service_price_select_member" on public.service_price;
create policy "service_price_select_member"
  on public.service_price for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "service_price_insert_tenant_admin" on public.service_price;
create policy "service_price_insert_tenant_admin"
  on public.service_price for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "service_price_delete_tenant_admin" on public.service_price;
create policy "service_price_delete_tenant_admin"
  on public.service_price for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- clinic_schedule --------------------------------------------------------
alter table public.clinic_schedule enable row level security;

drop policy if exists "clinic_schedule_select_member" on public.clinic_schedule;
create policy "clinic_schedule_select_member"
  on public.clinic_schedule for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "clinic_schedule_insert_tenant_admin" on public.clinic_schedule;
create policy "clinic_schedule_insert_tenant_admin"
  on public.clinic_schedule for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "clinic_schedule_update_tenant_admin" on public.clinic_schedule;
create policy "clinic_schedule_update_tenant_admin"
  on public.clinic_schedule for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "clinic_schedule_delete_tenant_admin" on public.clinic_schedule;
create policy "clinic_schedule_delete_tenant_admin"
  on public.clinic_schedule for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- professional_schedule --------------------------------------------------
alter table public.professional_schedule enable row level security;

drop policy if exists "professional_schedule_select_member" on public.professional_schedule;
create policy "professional_schedule_select_member"
  on public.professional_schedule for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "professional_schedule_insert_tenant_admin" on public.professional_schedule;
create policy "professional_schedule_insert_tenant_admin"
  on public.professional_schedule for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "professional_schedule_update_tenant_admin" on public.professional_schedule;
create policy "professional_schedule_update_tenant_admin"
  on public.professional_schedule for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "professional_schedule_delete_tenant_admin" on public.professional_schedule;
create policy "professional_schedule_delete_tenant_admin"
  on public.professional_schedule for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- schedule_exception -----------------------------------------------------
alter table public.schedule_exception enable row level security;

drop policy if exists "schedule_exception_select_member" on public.schedule_exception;
create policy "schedule_exception_select_member"
  on public.schedule_exception for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "schedule_exception_insert_tenant_admin" on public.schedule_exception;
create policy "schedule_exception_insert_tenant_admin"
  on public.schedule_exception for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "schedule_exception_update_tenant_admin" on public.schedule_exception;
create policy "schedule_exception_update_tenant_admin"
  on public.schedule_exception for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "schedule_exception_delete_tenant_admin" on public.schedule_exception;
create policy "schedule_exception_delete_tenant_admin"
  on public.schedule_exception for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- ----------------------------------------------------------------------------
-- 10. Auditoría de cambios de configuración (RF-CON15)
-- ----------------------------------------------------------------------------
drop trigger if exists trg_audit_service on public.service;
create trigger trg_audit_service
  after insert or update or delete on public.service
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_service_price on public.service_price;
create trigger trg_audit_service_price
  after insert or update or delete on public.service_price
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_clinic_schedule on public.clinic_schedule;
create trigger trg_audit_clinic_schedule
  after insert or update or delete on public.clinic_schedule
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_professional_schedule on public.professional_schedule;
create trigger trg_audit_professional_schedule
  after insert or update or delete on public.professional_schedule
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_schedule_exception on public.schedule_exception;
create trigger trg_audit_schedule_exception
  after insert or update or delete on public.schedule_exception
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_tenant_settings on public.tenant_settings;
create trigger trg_audit_tenant_settings
  after insert or update or delete on public.tenant_settings
  for each row execute function public.log_audit();
