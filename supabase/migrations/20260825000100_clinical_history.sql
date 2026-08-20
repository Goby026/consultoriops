-- ConsultorioPS - Historial clínico: auditoría de acceso (RF07 / Flujo 6 / RN13).
-- RPC security definer: registra en audit_log la consulta de un historial clínico.

create or replace function public.log_clinical_history_access(
  p_tenant_id uuid,
  p_patient_id uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_roles text[];
begin
  -- Solo roles clínicos con membresía activa en el consultorio.
  select array_agg(r.code) into v_roles
  from public.tenant_membership tm
  join public.role r on r.id = tm.role_id
  where tm.tenant_id = p_tenant_id
    and tm.user_id = auth.uid()
    and tm.status = 'active';

  if v_roles is null or not (v_roles && array['professional', 'tenant_admin']) then
    raise exception 'No autorizado para consultar historial clínico';
  end if;

  -- El paciente debe pertenecer al consultorio (RN01).
  if not exists (
    select 1 from public.patient p
    where p.id = p_patient_id and p.tenant_id = p_tenant_id
  ) then
    raise exception 'El paciente no pertenece al consultorio';
  end if;

  insert into public.audit_log (tenant_id, user_id, action, table_name, record_id, metadata)
  values (
    p_tenant_id,
    auth.uid(),
    'CLINICAL_HISTORY_ACCESS',
    'patient',
    p_patient_id::text,
    jsonb_build_object('roles', v_roles)
  );
end;
$$;

grant execute on function public.log_clinical_history_access(uuid, uuid) to authenticated;
