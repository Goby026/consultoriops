-- ============================================================================
-- Superusuario de plataforma
-- 1. user_profile.must_change_password (reseteo con cambio forzado)
-- 2. Backfill: el superusuario queda como tenant_admin de todos los consultorios
-- 3. Re-descripción del rol platform_admin como superusuario global
-- ============================================================================

-- 1. Flag para forzar cambio de contraseña en el próximo inicio de sesión
alter table public.user_profile
  add column if not exists must_change_password boolean not null default false;

-- 2. El admin de plataforma gestiona todos los consultorios: membresía tenant_admin
-- en cada tenant, actualizando rol/estado si ya existía una membresía.
insert into public.tenant_membership (tenant_id, user_id, role_id, status)
select t.id, pa.id, r.id, 'active'
from public.tenant t
cross join (select id from public.user_profile where is_platform_admin) pa
join public.role r on r.code = 'tenant_admin'
on conflict (tenant_id, user_id)
do update set role_id = excluded.role_id, status = 'active';

-- 3. El rol platform_admin pasa a describirse como superusuario global
update public.role
set description = 'Superusuario global: gestiona todo el sistema, reestablece contraseñas y administra todos los consultorios.'
where code = 'platform_admin';