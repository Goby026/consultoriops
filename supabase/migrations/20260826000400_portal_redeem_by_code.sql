-- ConsultorioPS - Portal del Paciente: registro sin conocer el tenant.
-- /portal/registro solo pide el código; este RPC resuelve el tenant:
-- 1. patient.access_code (único entre tenants) -> ficha exacta.
-- 2. tenant.patient_signup_code (active) -> código general.
-- Además se normaliza el código general a mayúsculas en la comparación.

-- Reescribe redeem_patient_code para comparar el código general sin distinguir mayúsculas.
create or replace function public.redeem_patient_code(
  p_tenant_id uuid,
  p_code      text,
  p_identity  jsonb
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_uid         uuid := auth.uid();
  v_patient_id  uuid;
  v_role_id     bigint;
  v_doc_type    text;
  v_doc_number  text;
  v_email       text;
begin
  if v_uid is null then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from public.tenant where id = p_tenant_id and status = 'active') then
    raise exception 'El consultorio no está activo';
  end if;

  select id into v_patient_id
    from public.patient where tenant_id = p_tenant_id and user_id = v_uid;

  if v_patient_id is null then
    select id into v_patient_id
      from public.patient
      where tenant_id = p_tenant_id
        and access_code = upper(p_code)
        and (access_code_expires_at is null or access_code_expires_at >= now());
    if v_patient_id is not null then
      if exists (select 1 from public.patient where id = v_patient_id and user_id is not null and user_id <> v_uid) then
        raise exception 'El código ya fue utilizado';
      end if;
      update public.patient set user_id = v_uid where id = v_patient_id;
    else
      if not exists (
        select 1 from public.tenant
        where id = p_tenant_id and upper(patient_signup_code) = upper(p_code)
      ) then
        raise exception 'Código de vinculación inválido o expirado';
      end if;

      v_doc_type   := nullif(p_identity ->> 'identity_doc_type', '');
      v_doc_number := nullif(p_identity ->> 'identity_doc_number', '');
      v_email      := nullif(p_identity ->> 'email', '');

      select id into v_patient_id
        from public.patient
        where tenant_id = p_tenant_id
          and identity_doc_type = v_doc_type
          and identity_doc_number = v_doc_number
          and user_id is null
          and (email is null or lower(email) = lower(coalesce(v_email, '')))
        limit 1;

      if v_patient_id is null and v_email is not null then
        select id into v_patient_id
          from public.patient
          where tenant_id = p_tenant_id
            and lower(email) = lower(v_email)
            and user_id is null
          limit 1;
      end if;

      if v_patient_id is null then
        if p_identity ->> 'first_name' is null or p_identity ->> 'last_name' is null
           or p_identity ->> 'birth_date' is null then
          raise exception 'Datos de identidad incompletos';
        end if;
        insert into public.patient (
          tenant_id, first_name, last_name, birth_date, gender,
          identity_doc_type, identity_doc_number, phone, email, is_minor, user_id
        )
        values (
          p_tenant_id,
          p_identity ->> 'first_name',
          p_identity ->> 'last_name',
          (p_identity ->> 'birth_date')::date,
          nullif(p_identity ->> 'gender', ''),
          v_doc_type, v_doc_number,
          nullif(p_identity ->> 'phone', ''),
          coalesce(v_email, lower((select email from auth.users where id = v_uid))),
          ((p_identity ->> 'birth_date')::date <= now()::date - interval '18 years') is false,
          v_uid
        )
        returning id into v_patient_id;
      else
        update public.patient set user_id = v_uid where id = v_patient_id;
      end if;
    end if;
  end if;

  select id into v_role_id from public.role where code = 'patient';
  insert into public.tenant_membership (tenant_id, user_id, role_id, status)
  values (p_tenant_id, v_uid, v_role_id, 'active')
  on conflict (tenant_id, user_id)
  do update set role_id = excluded.role_id, status = 'active';

  return v_patient_id;
end;
$$;

-- Entrada del frontend /portal/registro: resuelve el tenant desde el código.
create or replace function public.redeem_by_code(p_code text, p_identity jsonb)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid;
  v_uid    uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'No autorizado';
  end if;

  select tenant_id into v_tenant
    from public.patient
    where access_code = upper(p_code)
      and (access_code_expires_at is null or access_code_expires_at >= now())
    limit 1;

  if v_tenant is null then
    select id into v_tenant
      from public.tenant
      where upper(patient_signup_code) = upper(p_code) and status = 'active'
      limit 1;
  end if;

  if v_tenant is null then
    raise exception 'Código de vinculación inválido o expirado';
  end if;

  return public.redeem_patient_code(v_tenant, upper(p_code), p_identity);
end;
$$;

grant execute on function public.redeem_by_code(text, jsonb) to authenticated;