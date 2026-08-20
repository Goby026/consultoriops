-- ============================================================================
-- Superusuario: acceso elevado en todos los consultorios (desacople de membresía)
-- El Admin de Plataforma administra la configuración de cualquier consultorio
-- sin depender del rol mutable de su membresía. Los roles clínicos
-- (professional, patient) siguen restringidos a membresías reales.
-- ============================================================================

-- is_tenant_member: el superusuario cuenta como miembro de cualquier tenant.
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.tenant_membership tm
    where tm.user_id = auth.uid()
      and tm.tenant_id = p_tenant_id
      and tm.status = 'active'
      and (tm.valid_from is null or tm.valid_from <= now())
      and (tm.valid_to is null or tm.valid_to >= now())
  );
$$;

-- has_role_in_tenant: el superusuario satisface el chequeo de tenant_admin,
-- pero NO el de profesional/paciente/recepcionista.
create or replace function public.has_role_in_tenant(p_tenant_id uuid, p_roles text[])
returns boolean
language sql stable security definer set search_path = public
as $$
  select (public.is_platform_admin() and 'tenant_admin' = any(p_roles)) or exists (
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