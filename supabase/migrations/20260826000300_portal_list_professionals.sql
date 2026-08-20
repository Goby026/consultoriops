-- ConsultorioPS - Portal del Paciente: listado de profesionales para agendar.
-- El paciente no puede listar tenant_membership ajenos (RLS self_or_admin),
-- así que "Solicitar cita" necesita un RPC security definer con los profesionales
-- activos del consultorio (spec: servicio -> profesional -> dia -> horario).

create or replace function public.list_tenant_professionals(p_tenant_id uuid)
returns table (
  id        uuid,
  full_name text,
  email     text
)
language sql stable security definer set search_path = public
as $$
  select up.id, up.full_name, up.email
  from public.user_profile up
  join public.tenant_membership tm on tm.user_id = up.id
  join public.role r on r.id = tm.role_id
  where tm.tenant_id = p_tenant_id
    and tm.status = 'active'
    and r.code in ('professional', 'tenant_admin')
  order by up.full_name;
$$;

grant execute on function public.list_tenant_professionals(uuid) to authenticated;