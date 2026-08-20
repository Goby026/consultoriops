-- ============================================================================
-- Caja y cobros: registro de cobros sobre citas con pagos parciales y saldo
-- derivado (appointment.price - sum(payment.amount)). Nivel 1 de control
-- económico. Complementa RF-CON10/RF-CON11/RF-CON12/RF13 y RN00d.
-- ============================================================================

-- 1. payment ---------------------------------------------------------------
create table if not exists public.payment (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenant(id) on delete cascade,
  appointment_id     uuid not null references public.appointment(id) on delete cascade,
  amount             numeric(10,2) not null check (amount > 0),
  payment_method_id  uuid references public.payment_method(id) on delete set null,
  paid_at            timestamptz not null default now(),
  notes              text,
  recorded_by        uuid references auth.users(id) on delete set null default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_payment_tenant_date on public.payment (tenant_id, paid_at);
create index if not exists idx_payment_appointment on public.payment (appointment_id);

drop trigger if exists trg_payment_updated on public.payment;
create trigger trg_payment_updated
  before update on public.payment
  for each row execute function public.set_updated_at();

-- 2. Trigger de validación (integridad de cobros) ---------------------------
create or replace function public.validate_payment()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_status    text;
  v_price     numeric(10,2);
  v_paid      numeric(10,2);
begin
  select tenant_id, status, price
  into v_tenant_id, v_status, v_price
  from public.appointment
  where id = new.appointment_id;

  if v_tenant_id is null then
    raise exception 'La cita no existe';
  end if;
  if v_tenant_id <> new.tenant_id then
    raise exception 'La cita pertenece a otro consultorio';
  end if;
  if v_status = 'CANCELADA' then
    raise exception 'No se puede cobrar una cita cancelada';
  end if;

  select coalesce(sum(amount), 0)
  into v_paid
  from public.payment
  where appointment_id = new.appointment_id
    and id is distinct from new.id;

  if new.amount > (v_price - v_paid) then
    raise exception 'El cobro excede el saldo restante de la cita (%)', (v_price - v_paid);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_payment_validate on public.payment;
create trigger trg_payment_validate
  before insert or update on public.payment
  for each row execute function public.validate_payment();

-- 3. RLS --------------------------------------------------------------------
alter table public.payment enable row level security;

drop policy if exists "payment_select_member" on public.payment;
create policy "payment_select_member"
  on public.payment for select to authenticated
  using (
    public.is_tenant_member(tenant_id)
    and exists (
      select 1 from public.appointment a
      where a.id = appointment_id
        and (
          a.professional_id = auth.uid()
          or public.has_role_in_tenant(tenant_id, array['tenant_admin', 'receptionist'])
        )
    )
  );

drop policy if exists "payment_insert_staff" on public.payment;
create policy "payment_insert_staff"
  on public.payment for insert to authenticated
  with check (
    public.has_role_in_tenant(tenant_id, array['tenant_admin', 'receptionist'])
    or (
      public.has_role_in_tenant(tenant_id, array['professional'])
      and exists (
        select 1 from public.appointment a
        where a.id = appointment_id and a.professional_id = auth.uid()
      )
    )
  );

-- Los cobros son inmutables (sin update). Corrección: delete, solo admin.
drop policy if exists "payment_delete_tenant_admin" on public.payment;
create policy "payment_delete_tenant_admin"
  on public.payment for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- 4. Auditoría (RN00d / RF-CON15) --------------------------------------------
drop trigger if exists trg_audit_payment on public.payment;
create trigger trg_audit_payment
  after insert or update or delete on public.payment
  for each row execute function public.log_audit();