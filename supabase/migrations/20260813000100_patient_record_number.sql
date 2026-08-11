-- ============================================================================
-- ConsultorioPS - Pacientes: N.° de historia clínica automático correlativo
-- ============================================================================
-- Contador por tenant (incremento atómico vía ON CONFLICT DO UPDATE) y trigger
-- que asigna "HCL-XXXX" en cada insert de paciente sin número. Idempotente.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. tenant_counter (contador correlativo por consultorio)
-- ----------------------------------------------------------------------------
create table if not exists public.tenant_counter (
  tenant_id          uuid primary key references public.tenant(id) on delete cascade,
  next_patient_number bigint not null default 1
);

-- Tabla técnica: nadie accede por la API. Con RLS activo y sin políticas,
-- todo acceso directo queda denegado (solo las funciones security definer
-- pueden escribir).
alter table public.tenant_counter enable row level security;

-- ----------------------------------------------------------------------------
-- 2. next_patient_record_number(tenant) -> 'HCL-0001'
-- ----------------------------------------------------------------------------
create or replace function public.next_patient_record_number(p_tenant_id uuid)
returns text
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_next bigint;
begin
  insert into public.tenant_counter (tenant_id, next_patient_number)
  values (p_tenant_id, 1)
  on conflict (tenant_id)
  do update set next_patient_number = public.tenant_counter.next_patient_number + 1
  returning next_patient_number into v_next;

  return 'HCL-' || lpad(v_next::text, 4, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Trigger que asigna el número automáticamente (RF04)
-- ----------------------------------------------------------------------------
create or replace function public.assign_patient_record_number()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.medical_record_number is null or new.medical_record_number = '' then
    new.medical_record_number := public.next_patient_record_number(new.tenant_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_patient_record_number on public.patient;
create trigger trg_patient_record_number
  before insert on public.patient
  for each row execute function public.assign_patient_record_number();

-- ----------------------------------------------------------------------------
-- 4. Backfill de pacientes existentes sin número (por orden de creación)
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select id, tenant_id
    from public.patient
    where medical_record_number is null or medical_record_number = ''
    order by created_at
  loop
    update public.patient
    set medical_record_number = public.next_patient_record_number(r.tenant_id)
    where id = r.id;
  end loop;
end;
$$;
