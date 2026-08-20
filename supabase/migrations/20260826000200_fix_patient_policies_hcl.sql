-- ConsultorioPS - Portal del Paciente: correcciones posteriores al push de
-- 20260826000100_patient_portal.sql
--
-- 1. Bug RLS: las políticas de cita del paciente comparaban `p.tenant_id = p.tenant_id`
--    (siempre true), permitiendo citas cruzadas de tenant si el paciente tenía una
--    ficha con user_id propio en otro consultorio.
-- 2. N.º HCL automático en el alta por código general (spec: "activa el
--    medical_record_number automático").

-- 1) Corrige las políticas de appointment del paciente.
alter policy appointment_insert_self_patient on public.appointment
  with check (
    (status is null or status = 'PROGRAMADA')
    and exists (
      select 1 from public.patient p
      where p.id = appointment.patient_id
        and p.user_id = auth.uid()
        and p.tenant_id = appointment.tenant_id
    )
  );

alter policy appointment_select_self_patient on public.appointment
  using (
    exists (
      select 1 from public.patient p
      where p.id = appointment.patient_id
        and p.user_id = auth.uid()
        and p.tenant_id = appointment.tenant_id
    )
  );

-- 2) N.º HCL automático por tenant (solo cuando la ficha no lo trae).
create sequence if not exists public.patient_hcl_seq start 1;
grant usage on sequence public.patient_hcl_seq to authenticated;

create or replace function public.assign_patient_hcl()
returns trigger
language plpgsql
as $$
begin
  if new.medical_record_number is null then
    new.medical_record_number := 'HCL-' || lpad(nextval('public.patient_hcl_seq')::text, 8, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patient_hcl on public.patient;
create trigger trg_patient_hcl
  before insert on public.patient
  for each row execute function public.assign_patient_hcl();