-- Corrección a trg_protect_signed_note (RN10): permite el delete en cascada
-- (pg_trigger_depth() > 0) para que borrar un expediente completo (p. ej.
-- paciente/consultorio) no falle por notas firmadas. La firma en sí sigue
-- siendo el único update permitido sobre una nota (old.signed_at null).
create or replace function public.protect_signed_note()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'DELETE' and old.signed_at is not null and pg_trigger_depth() = 0 then
    raise exception 'Nota clínica firmada: no se permite modificar ni eliminar (RN10)';
  end if;
  if TG_OP = 'UPDATE' and old.signed_at is not null then
    raise exception 'Nota clínica firmada: no se permite modificar ni eliminar (RN10)';
  end if;
  return coalesce(new, old);
end;
$$;