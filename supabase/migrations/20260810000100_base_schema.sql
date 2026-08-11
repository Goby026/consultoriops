-- ============================================================================
-- ConsultorioPS - Fase 1: Núcleo multi-tenant + Auth + RLS
-- ============================================================================
-- Aplicar en Supabase SQL Editor (o vía `supabase db push`).
-- Contiene: roles, tenant, tenant_settings, user_profile, tenant_membership,
-- audit_log, funciones de seguridad RLS y políticas.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Roles (catálogo global de la plataforma)
-- ----------------------------------------------------------------------------
create table if not exists public.role (
  id              bigint generated always as identity primary key,
  code            text not null unique,
  name            text not null,
  platform_scope  boolean not null default false,
  description     text,
  created_at      timestamptz not null default now()
);

insert into public.role (code, name, platform_scope, description) values
  ('platform_admin', 'Administrador de Plataforma', true,  'Administra la plataforma SaaS y los consultorios. Sin acceso ordinario al contenido clínico.'),
  ('tenant_admin',   'Administrador de Consultorio', false, 'Administra un consultorio específico: usuarios, profesionales, horarios, servicios, precios y configuración.'),
  ('professional',   'Profesional (Psicólogo)',      false, 'Atiende pacientes, registra anamnesis, evolución, diagnóstico y tratamiento. Único rol que firma notas clínicas.'),
  ('receptionist',   'Recepcionista',                false, 'Gestiona pacientes y citas. Sin acceso al contenido clínico de las sesiones.'),
  ('patient',        'Paciente',                     false, 'Solicita citas, consulta su información resumida y firma su consentimiento informado.'),
  ('legal_guardian', 'Representante legal',          false, 'Actúa en nombre de un paciente menor de edad.')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Helper de timestamps
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. tenant (consultorio / tenant lógico)
-- ----------------------------------------------------------------------------
create table if not exists public.tenant (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  status      text not null default 'active'
              check (status in ('active', 'suspended', 'blocked', 'inactive')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_tenant_updated on public.tenant;
create trigger trg_tenant_updated
  before update on public.tenant
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. tenant_settings (configuración general del consultorio)
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_settings (
  tenant_id   uuid primary key references public.tenant(id) on delete cascade,
  legal_name  text,
  tax_id      text,
  address     text,
  phone       text,
  email       text,
  timezone    text not null default 'America/Lima',
  logo_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_tenant_settings_updated on public.tenant_settings;
create trigger trg_tenant_settings_updated
  before update on public.tenant_settings
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. user_profile (identidad global, 1:1 con auth.users)
-- ----------------------------------------------------------------------------
create table if not exists public.user_profile (
  id                 uuid primary key references auth.users(id) on delete cascade,
  full_name          text not null default '',
  email              text,
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_user_profile_updated on public.user_profile;
create trigger trg_user_profile_updated
  before update on public.user_profile
  for each row execute function public.set_updated_at();

-- Crea user_profile automáticamente al registrarse un usuario en Supabase Auth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.user_profile (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- 6. tenant_membership (membresía usuario <-> consultorio con rol y estado)
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_membership (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role_id     bigint not null references public.role(id),
  status      text not null default 'active'
              check (status in ('active', 'inactive', 'suspended')),
  valid_from  timestamptz,
  valid_to    timestamptz,
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists idx_tenant_membership_user on public.tenant_membership (user_id);
create index if not exists idx_tenant_membership_tenant on public.tenant_membership (tenant_id);

-- ----------------------------------------------------------------------------
-- 7. audit_log (bitácora de trazabilidad)
-- ----------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  tenant_id   uuid references public.tenant(id) on delete set null,
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,
  table_name  text,
  record_id   text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_tenant on public.audit_log (tenant_id);
create index if not exists idx_audit_log_user on public.audit_log (user_id);
create index if not exists idx_audit_log_created on public.audit_log (created_at);

-- ----------------------------------------------------------------------------
-- 8. Funciones de seguridad RLS
-- ----------------------------------------------------------------------------
-- Estas funciones derivan identidad, membresía y rol del JWT autenticado.
-- El tenant_id nunca se confía a lo enviado por el frontend.

-- ¿El usuario autenticado es Administrador de Plataforma?
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select is_platform_admin from public.user_profile where id = auth.uid()),
    false
  );
$$;

-- ¿El usuario tiene una membresía activa en el tenant dado?
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_membership tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.status = 'active'
      and (tm.valid_from is null or tm.valid_from <= now())
      and (tm.valid_to is null or tm.valid_to >= now())
  );
$$;

-- ¿El usuario tiene alguno de los roles indicados dentro del tenant?
create or replace function public.has_role_in_tenant(p_tenant_id uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.tenant_membership tm
    join public.role r on r.id = tm.role_id
    where tm.user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.status = 'active'
      and r.code = any(p_roles)
      and (tm.valid_from is null or tm.valid_from <= now())
      and (tm.valid_to is null or tm.valid_to >= now())
  );
$$;

-- ----------------------------------------------------------------------------
-- 9. RLS: habilitación y políticas
-- ----------------------------------------------------------------------------

-- role ----------------------------------------------------------------
alter table public.role enable row level security;

drop policy if exists "role_select_authenticated" on public.role;
create policy "role_select_authenticated"
  on public.role for select to authenticated
  using (true);

-- tenant ---------------------------------------------------------------
alter table public.tenant enable row level security;

drop policy if exists "tenant_select_member_or_platform" on public.tenant;
create policy "tenant_select_member_or_platform"
  on public.tenant for select to authenticated
  using (public.is_platform_admin() or public.is_tenant_member(id));

drop policy if exists "tenant_insert_platform_admin" on public.tenant;
create policy "tenant_insert_platform_admin"
  on public.tenant for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists "tenant_update_platform_admin" on public.tenant;
create policy "tenant_update_platform_admin"
  on public.tenant for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "tenant_delete_platform_admin" on public.tenant;
create policy "tenant_delete_platform_admin"
  on public.tenant for delete to authenticated
  using (public.is_platform_admin());

-- tenant_settings ------------------------------------------------------
alter table public.tenant_settings enable row level security;

drop policy if exists "tenant_settings_select_member" on public.tenant_settings;
create policy "tenant_settings_select_member"
  on public.tenant_settings for select to authenticated
  using (public.is_platform_admin() or public.is_tenant_member(tenant_id));

drop policy if exists "tenant_settings_insert_platform_admin" on public.tenant_settings;
create policy "tenant_settings_insert_platform_admin"
  on public.tenant_settings for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists "tenant_settings_update_tenant_admin" on public.tenant_settings;
create policy "tenant_settings_update_tenant_admin"
  on public.tenant_settings for update to authenticated
  using (public.is_platform_admin() or public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.is_platform_admin() or public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "tenant_settings_delete_platform_admin" on public.tenant_settings;
create policy "tenant_settings_delete_platform_admin"
  on public.tenant_settings for delete to authenticated
  using (public.is_platform_admin());

-- user_profile ---------------------------------------------------------
alter table public.user_profile enable row level security;

drop policy if exists "user_profile_select_self_or_platform" on public.user_profile;
create policy "user_profile_select_self_or_platform"
  on public.user_profile for select to authenticated
  using (id = auth.uid() or public.is_platform_admin());

drop policy if exists "user_profile_insert_self" on public.user_profile;
create policy "user_profile_insert_self"
  on public.user_profile for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "user_profile_update_self" on public.user_profile;
create policy "user_profile_update_self"
  on public.user_profile for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- tenant_membership ----------------------------------------------------
alter table public.tenant_membership enable row level security;

drop policy if exists "tenant_membership_select_self_or_admin" on public.tenant_membership;
create policy "tenant_membership_select_self_or_admin"
  on public.tenant_membership for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_platform_admin()
    or public.has_role_in_tenant(tenant_id, array['tenant_admin'])
  );

drop policy if exists "tenant_membership_insert_platform_admin" on public.tenant_membership;
create policy "tenant_membership_insert_platform_admin"
  on public.tenant_membership for insert to authenticated
  with check (public.is_platform_admin());

drop policy if exists "tenant_membership_update_platform_admin" on public.tenant_membership;
create policy "tenant_membership_update_platform_admin"
  on public.tenant_membership for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists "tenant_membership_delete_platform_admin" on public.tenant_membership;
create policy "tenant_membership_delete_platform_admin"
  on public.tenant_membership for delete to authenticated
  using (public.is_platform_admin());

-- audit_log ------------------------------------------------------------
alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_platform_admin" on public.audit_log;
create policy "audit_log_select_platform_admin"
  on public.audit_log for select to authenticated
  using (public.is_platform_admin());

-- ----------------------------------------------------------------------------
-- 10. Auditoría automática de cambios críticos (RF-SaaS10)
-- ----------------------------------------------------------------------------
create or replace function public.log_audit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant_id  uuid;
  v_pk_list    text[];
  v_record_id  text;
  v_json       jsonb;
begin
  -- La tabla `tenant` no tiene columna tenant_id; su propio id es el tenant.
  if tg_table_name = 'tenant' then
    v_tenant_id := coalesce(new.id, old.id);
  else
    v_tenant_id := coalesce(new.tenant_id, old.tenant_id);
  end if;

  -- Clave(s) primaria(s) reales de la tabla disparadora.
  select array_agg(a.attname order by a.attnum)
  into v_pk_list
  from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
  where i.indrelid = tg_relid
    and i.indisprimary;

  v_json := to_jsonb(coalesce(new, old));

  if v_pk_list is not null then
    select jsonb_build_object('pk', jsonb_object_agg(k, v_json -> k))::text
    into v_record_id
    from unnest(v_pk_list) k;
  end if;

  insert into public.audit_log (tenant_id, user_id, action, table_name, record_id, metadata)
  values (
    v_tenant_id,
    auth.uid(),
    tg_op,
    tg_table_name,
    v_record_id,
    jsonb_build_object(
      'old', case when tg_op = 'INSERT' then null else to_jsonb(old) end,
      'new', case when tg_op = 'DELETE' then null else to_jsonb(new) end
    )
  );
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_audit_tenant on public.tenant;
create trigger trg_audit_tenant
  after insert or update or delete on public.tenant
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_membership on public.tenant_membership;
create trigger trg_audit_membership
  after insert or update or delete on public.tenant_membership
  for each row execute function public.log_audit();
