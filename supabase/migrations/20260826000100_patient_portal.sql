-- ============================================================================
-- Portal del Paciente (RF28–RF31, RF07b/RF30)
-- 1. Vínculo usuario↔ficha (patient.user_id) + códigos de vinculación.
-- 2. RLS: el rol patient solo ve sus propios datos (RN07); staff conserva acceso.
-- 3. RPC security definer: redeem_patient_code, generate_patient_code,
--    set_patient_signup_code, cancel_own_appointment, get_patient_history_summary,
--    accept_consent.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Esquema: vínculo y códigos
-- ----------------------------------------------------------------------------
alter table public.patient
  add column if not exists user_id uuid references auth.users(id) on delete set null,
  add column if not exists access_code text,
  add column if not exists access_code_expires_at timestamptz;

alter table public.tenant
  add column if not exists patient_signup_code text;

create index if not exists idx_patient_user on public.patient (user_id) where user_id is not null;
create unique index if not exists idx_patient_tenant_user
  on public.patient (tenant_id, user_id) where user_id is not null;
create unique index if not exists idx_patient_access_code
  on public.patient (access_code) where access_code is not null;

-- ----------------------------------------------------------------------------
-- 2. RLS: aislamiento del rol patient (RN07 / RN00)
--    Las policies "select_member" pasan de is_tenant_member (todo el tenant) a
--    roles staff. Se añaden variantes select_self por patient.user_id.
-- ----------------------------------------------------------------------------

-- patient
drop policy if exists "patient_select_member" on public.patient;
create policy "patient_select_member"
  on public.patient for select to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

drop policy if exists "patient_select_self" on public.patient;
create policy "patient_select_self"
  on public.patient for select to authenticated
  using (user_id = auth.uid());

-- legal_guardian
drop policy if exists "legal_guardian_select_member" on public.legal_guardian;
create policy "legal_guardian_select_member"
  on public.legal_guardian for select to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

drop policy if exists "legal_guardian_select_self" on public.legal_guardian;
create policy "legal_guardian_select_self"
  on public.legal_guardian for select to authenticated
  using (exists (
    select 1 from public.patient p
    where p.id = patient_id and p.user_id = auth.uid()
  ));

-- appointment: select staff + self; insert staff + self
drop policy if exists "appointment_select_member" on public.appointment;
create policy "appointment_select_member"
  on public.appointment for select to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

drop policy if exists "appointment_select_self_patient" on public.appointment;
create policy "appointment_select_self_patient"
  on public.appointment for select to authenticated
  using (exists (
    select 1 from public.patient p
    where p.id = patient_id and p.user_id = auth.uid() and p.tenant_id = tenant_id
  ));

drop policy if exists "appointment_insert_self_patient" on public.appointment;
create policy "appointment_insert_self_patient"
  on public.appointment for insert to authenticated
  with check (
    (status is null or status = 'PROGRAMADA')
    and exists (
      select 1 from public.patient p
      where p.id = patient_id and p.user_id = auth.uid() and p.tenant_id = tenant_id
    )
  );

-- informed_consent: select staff + self (insert sigue siendo staff/RPC)
drop policy if exists "informed_consent_select_member" on public.informed_consent;
create policy "informed_consent_select_member"
  on public.informed_consent for select to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin', 'professional', 'receptionist']));

drop policy if exists "informed_consent_select_self" on public.informed_consent;
create policy "informed_consent_select_self"
  on public.informed_consent for select to authenticated
  using (exists (
    select 1 from public.patient p
    where p.id = patient_id and p.user_id = auth.uid()
  ));

-- storage: el paciente solo puede leer la evidencia de SUS consentimientos
drop policy if exists "clinical_docs_select_member" on storage.objects;
create policy "clinical_docs_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinical-docs'
    and cardinality(storage.foldername(name)) > 0
    and public.has_role_in_tenant(
      (storage.foldername(name))[1]::uuid,
      array['tenant_admin', 'professional', 'receptionist']
    )
  );

drop policy if exists "clinical_docs_select_self" on storage.objects;
create policy "clinical_docs_select_self"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'clinical-docs'
    and cardinality(storage.foldername(name)) >= 3
    and (storage.foldername(name))[2] = 'consents'
    and exists (
      select 1 from public.patient p
      where p.id = (storage.foldername(name))[3]::uuid
        and p.user_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- 3. RPCs del portal
-- ----------------------------------------------------------------------------

-- Genera/reemplaza el código por ficha (staff). Expira a las 72 h.
create or replace function public.generate_patient_code(p_patient_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant uuid;
  v_code   text;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  select tenant_id into v_tenant from public.patient where id = p_patient_id;
  if v_tenant is null then
    raise exception 'Paciente no encontrado';
  end if;
  if not public.has_role_in_tenant(v_tenant, array['tenant_admin', 'professional', 'receptionist']) then
    raise exception 'No autorizado';
  end if;
  loop
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (select 1 from public.patient where access_code = v_code);
  end loop;
  update public.patient
    set access_code = v_code, access_code_expires_at = now() + interval '72 hours'
    where id = p_patient_id;
  return v_code;
end;
$$;

-- Configura el código general del consultorio (tenant_admin).
create or replace function public.set_patient_signup_code(p_tenant_id uuid, p_code text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  if not public.has_role_in_tenant(p_tenant_id, array['tenant_admin']) then
    raise exception 'Solo el administrador del consultorio puede configurar el código';
  end if;
  update public.tenant set patient_signup_code = p_code where id = p_tenant_id;
end;
$$;

-- Canjea el código de vinculación (RF28): asocia la ficha y crea la membresía.
-- p_identity: { first_name, last_name, birth_date, gender, identity_doc_type,
--               identity_doc_number, phone, email }
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

  -- Ya vinculado en este consultorio: salta directo a la membresía.
  select id into v_patient_id
    from public.patient where tenant_id = p_tenant_id and user_id = v_uid;

  if v_patient_id is null then
    -- 1) Código por ficha (mecanismo principal).
    select id into v_patient_id
      from public.patient
      where tenant_id = p_tenant_id
        and access_code = p_code
        and (access_code_expires_at is null or access_code_expires_at >= now());
    if v_patient_id is not null then
      if exists (select 1 from public.patient where id = v_patient_id and user_id is not null and user_id <> v_uid) then
        raise exception 'El código ya fue utilizado';
      end if;
      update public.patient set user_id = v_uid where id = v_patient_id;
    else
      -- 2) Código general del consultorio.
      if not exists (
        select 1 from public.tenant
        where id = p_tenant_id and patient_signup_code = p_code
      ) then
        raise exception 'Código de vinculación inválido o expirado';
      end if;

      v_doc_type   := nullif(p_identity ->> 'identity_doc_type', '');
      v_doc_number := nullif(p_identity ->> 'identity_doc_number', '');
      v_email      := nullif(p_identity ->> 'email', '');

      -- Reclama una ficha existente por documento (si no tiene usuario asignado),
      -- aunque la ficha no registre email.
      select id into v_patient_id
        from public.patient
        where tenant_id = p_tenant_id
          and identity_doc_type = v_doc_type
          and identity_doc_number = v_doc_number
          and user_id is null
          and (email is null or lower(email) = lower(coalesce(v_email, '')))
        limit 1;

      -- Reclama por email si el documento no matcheó.
      if v_patient_id is null and v_email is not null then
        select id into v_patient_id
          from public.patient
          where tenant_id = p_tenant_id
            and lower(email) = lower(v_email)
            and user_id is null
          limit 1;
      end if;

      -- Crea la ficha si no existe.
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

-- Cancelación de la propia cita (RF29 + ventana de 24 h desde la creación).
create or replace function public.cancel_own_appointment(p_appointment_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_patient_id uuid;
  v_tenant     uuid;
  v_status     text;
  v_created    timestamptz;
  v_scheduled  timestamptz;
  v_row_tenant uuid;
begin
  select id, tenant_id into v_patient_id, v_tenant
    from public.patient where user_id = auth.uid() limit 1;
  if v_patient_id is null then
    raise exception 'No autorizado';
  end if;

  select status, created_at, scheduled_at, tenant_id
    into v_status, v_created, v_scheduled, v_row_tenant
    from public.appointment
    where id = p_appointment_id and patient_id = v_patient_id and tenant_id = v_tenant;
  if v_row_tenant is null then
    raise exception 'Cita no encontrada';
  end if;
  if v_status not in ('PROGRAMADA', 'REPROGRAMADA') then
    raise exception 'La cita no se puede cancelar';
  end if;
  if v_scheduled <= now() then
    raise exception 'No se puede cancelar una cita ya transcurrida';
  end if;
  if now() > v_created + interval '24 hours' then
    raise exception 'La cita ya está confirmada: la ventana de 24 horas venció';
  end if;

  update public.appointment set status = 'CANCELADA' where id = p_appointment_id;
end;
$$;

-- Historial resumido del paciente (RF30/RF07b): solo sesiones, sin contenido
-- clínico (SOAP, anamnesis, diagnósticos, escalas, alertas).
create or replace function public.get_patient_history_summary()
returns table (
  started_at        timestamptz,
  service_name      text,
  professional_name text,
  status            text
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  return query
    select s.started_at,
           coalesce(svc.name, 'Sin servicio'),
           coalesce(up.full_name, '—'),
           s.status
    from public.session s
    join public.appointment a on a.id = s.appointment_id
    left join public.service svc on svc.id = a.service_id
    left join public.user_profile up on up.id = s.professional_id
    where exists (
      select 1 from public.patient p
      where p.id = s.patient_id and p.user_id = auth.uid()
    )
    order by s.started_at desc;
end;
$$;

-- Aceptación electrónica del consentimiento (RF31).
create or replace function public.accept_consent()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_patient_id uuid;
  v_tenant     uuid;
  v_template   uuid;
  v_consent    uuid;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;
  select id, tenant_id into v_patient_id, v_tenant
    from public.patient where user_id = auth.uid() limit 1;
  if v_patient_id is null then
    raise exception 'No autorizado';
  end if;

  if exists (
    select 1 from public.informed_consent ic
    where ic.tenant_id = v_tenant
      and ic.patient_id = v_patient_id
      and ic.status = 'accepted'
      and (ic.valid_until is null or ic.valid_until >= now())
  ) then
    raise exception 'Ya firmaste el consentimiento informado';
  end if;

  select id into v_template
    from public.document_template dt
    where dt.tenant_id = v_tenant
      and dt.code = 'informed_consent'
      and dt.is_active
    order by dt.version desc
    limit 1;
  if v_template is null then
    raise exception 'No hay plantilla de consentimiento vigente';
  end if;

  insert into public.informed_consent (tenant_id, patient_id, document_template_id, accepted_by, status)
  values (v_tenant, v_patient_id, v_template, auth.uid(), 'accepted')
  returning id into v_consent;

  return v_consent;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Grants
-- ----------------------------------------------------------------------------
grant execute on function public.generate_patient_code(uuid) to authenticated;
grant execute on function public.set_patient_signup_code(uuid, text) to authenticated;
grant execute on function public.redeem_patient_code(uuid, text, jsonb) to authenticated;
grant execute on function public.cancel_own_appointment(uuid) to authenticated;
grant execute on function public.get_patient_history_summary() to authenticated;
grant execute on function public.accept_consent() to authenticated;
