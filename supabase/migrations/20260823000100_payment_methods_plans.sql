-- ============================================================================
-- Métodos de pago y planes de pago del consultorio (RF-CON11, RF-CON12, RF13)
-- Solo configuración; el registro de cobros sobre citas queda para otra
-- iteración (sobre service_price / appointment).
-- ============================================================================

-- 1. payment_method ----------------------------------------------------------
create table if not exists public.payment_method (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenant(id) on delete cascade,
  name        text not null,
  category    text not null default 'OTRO'
              check (category in ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO')),
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists idx_payment_method_tenant on public.payment_method (tenant_id);

drop trigger if exists trg_payment_method_updated on public.payment_method;
create trigger trg_payment_method_updated
  before update on public.payment_method
  for each row execute function public.set_updated_at();

-- 2. payment_plan (paquete de sesiones) --------------------------------------
create table if not exists public.payment_plan (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenant(id) on delete cascade,
  name              text not null,
  description       text,
  sessions_included int not null check (sessions_included > 0),
  price             numeric(10,2) not null default 0 check (price >= 0),
  valid_from        date,
  valid_to          date,
  active            boolean not null default true,
  sort_order        int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (tenant_id, name)
);

create index if not exists idx_payment_plan_tenant on public.payment_plan (tenant_id);

drop trigger if exists trg_payment_plan_updated on public.payment_plan;
create trigger trg_payment_plan_updated
  before update on public.payment_plan
  for each row execute function public.set_updated_at();

-- 3. RLS ---------------------------------------------------------------------
alter table public.payment_method enable row level security;

drop policy if exists "payment_method_select_member" on public.payment_method;
create policy "payment_method_select_member"
  on public.payment_method for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "payment_method_insert_tenant_admin" on public.payment_method;
create policy "payment_method_insert_tenant_admin"
  on public.payment_method for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "payment_method_update_tenant_admin" on public.payment_method;
create policy "payment_method_update_tenant_admin"
  on public.payment_method for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "payment_method_delete_tenant_admin" on public.payment_method;
create policy "payment_method_delete_tenant_admin"
  on public.payment_method for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

alter table public.payment_plan enable row level security;

drop policy if exists "payment_plan_select_member" on public.payment_plan;
create policy "payment_plan_select_member"
  on public.payment_plan for select to authenticated
  using (public.is_tenant_member(tenant_id));

drop policy if exists "payment_plan_insert_tenant_admin" on public.payment_plan;
create policy "payment_plan_insert_tenant_admin"
  on public.payment_plan for insert to authenticated
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "payment_plan_update_tenant_admin" on public.payment_plan;
create policy "payment_plan_update_tenant_admin"
  on public.payment_plan for update to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))
  with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

drop policy if exists "payment_plan_delete_tenant_admin" on public.payment_plan;
create policy "payment_plan_delete_tenant_admin"
  on public.payment_plan for delete to authenticated
  using (public.has_role_in_tenant(tenant_id, array['tenant_admin']));

-- 4. Auditoría (RF-CON15) ----------------------------------------------------
drop trigger if exists trg_audit_payment_method on public.payment_method;
create trigger trg_audit_payment_method
  after insert or update or delete on public.payment_method
  for each row execute function public.log_audit();

drop trigger if exists trg_audit_payment_plan on public.payment_plan;
create trigger trg_audit_payment_plan
  after insert or update or delete on public.payment_plan
  for each row execute function public.log_audit();