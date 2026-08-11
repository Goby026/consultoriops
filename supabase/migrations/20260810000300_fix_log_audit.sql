-- ============================================================================
-- ConsultorioPS - Fix: log_audit genérico
-- ============================================================================
-- log_audit() usaba `new.id::text` / `old.id::text` como record_id. Eso
-- revierte toda operación sobre tablas cuya clave primaria no se llama 'id'
-- (ej. tenant_settings, PK = tenant_id): el trigger de auditoría lanzaba
-- 'record "new" has no field "id"' y la sentencia se descartaba, por lo que
-- los cambios en "Datos institucionales" no se guardaban.
-- Ahora se resuelve la clave primaria real desde el catálogo.
-- ============================================================================

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
