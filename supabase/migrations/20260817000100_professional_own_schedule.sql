-- ============================================================================
-- ConsultorioPS - Fase 5: Mi horario (profesional gestiona su propio horario)
-- ============================================================================
-- RF-CON05/RF-CON06: el profesional puede registrar/editar sus propios bloques
-- de trabajo y descanso. El tenant_admin mantiene control total.
-- ============================================================================

alter table public.professional_schedule enable row level security;

drop policy if exists "professional_schedule_insert_own" on public.professional_schedule;
create policy "professional_schedule_insert_own"
  on public.professional_schedule for insert to authenticated
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

drop policy if exists "professional_schedule_update_own" on public.professional_schedule;
create policy "professional_schedule_update_own"
  on public.professional_schedule for update to authenticated
  using (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  )
  with check (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );

drop policy if exists "professional_schedule_delete_own" on public.professional_schedule;
create policy "professional_schedule_delete_own"
  on public.professional_schedule for delete to authenticated
  using (
    professional_id = auth.uid()
    and public.has_role_in_tenant(tenant_id, array['professional'])
  );
