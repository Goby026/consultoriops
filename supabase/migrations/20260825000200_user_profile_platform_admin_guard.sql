-- ----------------------------------------------------------------------------
-- Guarda de auto-promoción a is_platform_admin (seguridad, severidad alta)
--
-- La política "user_profile_update_self" permite a cualquier usuario actualizar
-- todas las columnas de su propio perfil vía el cliente, incluida
-- is_platform_admin. Este trigger bloquea cambios de ese flag salvo que el
-- invocador ya sea Administrador de Plataforma o el contexto sea de servidor
-- (service role / CLI postgres: auth.uid() es null). Cubre UPDATE e INSERT.
-- ----------------------------------------------------------------------------
create or replace function public.guard_platform_admin_flag()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and new.is_platform_admin is distinct from old.is_platform_admin)
     or (tg_op = 'INSERT' and new.is_platform_admin) then
    if not public.is_platform_admin() and auth.uid() is not null then
      raise exception 'permitido_platform_admin_solo: no puedes modificar is_platform_admin'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_user_profile_platform_admin_guard on public.user_profile;
create trigger trg_user_profile_platform_admin_guard
  before insert or update on public.user_profile
  for each row execute function public.guard_platform_admin_flag();