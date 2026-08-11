-- ============================================================================
-- Verificación de aislamiento multi-tenant (SRS §12 / §6.7)
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de aplicar la migración base.
-- Comprueba que un usuario del Tenant A nunca puede ver datos del Tenant B.
-- ============================================================================

begin;

-- Función de ayuda: cambia al rol authenticated simulando un JWT
do $$
declare
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_tenant_a uuid;
  v_tenant_b uuid;
  v_role_tenant_admin bigint;
  v_count int;
begin
  -- Usuarios simulados en auth.users (el trigger on_auth_user_created crea user_profile)
  insert into auth.users (id, email) values (v_user_a, 'a@test.local'), (v_user_b, 'b@test.local');

  select id into v_role_tenant_admin from public.role where code = 'tenant_admin';

  -- Dos consultorios independientes
  insert into public.tenant (id, slug, name) values (gen_random_uuid(), 'tenant-a-test', 'Tenant A') returning id into v_tenant_a;
  insert into public.tenant (id, slug, name) values (gen_random_uuid(), 'tenant-b-test', 'Tenant B') returning id into v_tenant_b;

  insert into public.tenant_settings (tenant_id) values (v_tenant_a), (v_tenant_b);

  insert into public.tenant_membership (tenant_id, user_id, role_id) values
    (v_tenant_a, v_user_a, v_role_tenant_admin),
    (v_tenant_b, v_user_b, v_role_tenant_admin);

  -- Usuario A autenticado: solo debe ver Tenant A
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"'||v_user_a||'","role":"authenticated"}', false);

  select count(*) into v_count from public.tenant;
  if v_count <> 1 then
    raise exception 'FALLO: Usuario A ve % consultorios (esperado 1)', v_count;
  end if;

  select count(*) into v_count
  from public.tenant_membership
  where user_id = v_user_b;
  if v_count <> 0 then
    raise exception 'FALLO: Usuario A ve membresías del Usuario B (% filas)', v_count;
  end if;

  select count(*) into v_count
  from public.tenant_settings
  where tenant_id = v_tenant_b;
  if v_count <> 0 then
    raise exception 'FALLO: Usuario A ve settings del Tenant B (% filas)', v_count;
  end if;

  -- Usuario B autenticado: intenta leer Tenant A y las membresías de A
  set local role authenticated;
  perform set_config('request.jwt.claims', '{"sub":"'||v_user_b||'","role":"authenticated"}', false);

  select count(*) into v_count from public.tenant where id = v_tenant_a;
  if v_count <> 0 then
    raise exception 'FALLO: Usuario B ve el Tenant A (% filas)', v_count;
  end if;

  reset role;

  raise notice 'OK: aislamiento multi-tenant verificado correctamente';
end $$;

-- Confirmación visible (las excepciones del bloque anterior abortarían la transacción)
select 'OK: aislamiento multi-tenant verificado correctamente' as resultado;

rollback;
