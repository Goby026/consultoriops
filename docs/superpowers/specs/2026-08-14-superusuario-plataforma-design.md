# Superusuario de plataforma

Fecha: 2026-08-14 · Proyecto: ConsultorioPS · Estado: aprobado

## Contexto

El administrador de plataforma (`george.rendich@gmail.com`, ya con `is_platform_admin = true`) necesita facultades de superusuario sobre todo el sistema:

1. Gestionar el sistema en general.
2. Reestablecer las contraseñas de otros usuarios.
3. Gestionar todos los consultorios (incluidos los que no administra).

Hoy, la RLS limita el acceso a tablas de configuración y clínicas a miembros del tenant
(`is_tenant_member` / `has_role_in_tenant`); el admin de plataforma solo ve los consultorios
donde tiene membresía activa (2 de 3) y no puede configurar el resto. No existe ningún flujo
de reseteo de contraseñas.

## Decisiones (aprobadas)

- **Acceso total**: el superusuario queda como `tenant_admin` de todos los consultorios,
  nuevos y existentes. Se reutilizan la RLS, el switcher de tenants y el enrutado existentes
  (basados en membresía). El rol `platform_admin` se re-descriLe como superusuario global.
- **Reseteo directo**: el superusuario fija la nueva contraseña (escrita o generada) y la
  entrega al usuario. Inmediato; funciona con correos de prueba.
- **Cambio forzado opcional**: el diálogo permite marcar "forzar cambio en el próximo
  inicio"; el usuario debe fijar una nueva contraseña antes de usar la app.

## Esquema y datos

Migración `20260821000100_superuser_platform.sql`:

- `alter table user_profile add column must_change_password boolean not null default false`.
- Backfill de membresías: para todo `user_profile.is_platform_admin` y todo `tenant`,
  upsert de membresía con rol `tenant_admin`, `status='active'`,
  `on conflict (tenant_id, user_id) do update set role_id = excluded.role_id, status = 'active'`.
- `update role set description = '...superusuario global...' where code = 'platform_admin'`.

## Edge functions

### `onboard_tenant` (modificación)

Además de la membresía del admin elegido, insertar membresía `tenant_admin` para el admin de
plataforma que llama (`on conflict do nothing`), de modo que los consultorios nuevos aparezcan
en su switcher de inmediato.

### `admin_users` (nueva)

Protegida server-side con `is_platform_admin` (mismo patrón `callerClient.getUser` +
`user_profile.is_platform_admin` de `onboard_tenant`). Usa cliente service-role.

Acción `reset_password`:

- Body: `{ userId, newPassword, forceChange }`.
- Valida `newPassword.length >= 6`.
- `client.auth.admin.updateUserById(userId, { password: newPassword })`.
- Si `forceChange`, `user_profile.must_change_password = true` para ese usuario.
- Inserta `audit_log` (`tenant_id` null, `user_id` = llamante, `action='auth.password_reset'`,
  `metadata: { target_user_id }`).
- Errores: usuario inexistente, contraseña corta, llamante no superusuario.

## Frontend

### Consola de Plataforma (`PlatformConsolePage`)

- `useUsers` ampliado: `select('id, email, full_name, is_platform_admin, must_change_password')`.
- Nueva tarjeta "Usuarios": tabla con email, nombre, badges (Superusuario / Cambiar contraseña)
  y acción "Reestablecer contraseña" por fila.
- Diálogo de reseteo: contraseña nueva (input) + botón "Generar" (aleatoria >= 6 chars),
  checkbox "Forzar cambio en el próximo inicio", Confirmar/Cancelar.
- Al confirmar: invoca `admin_users` (`reset_password`), toast de resultado, invalida
  `['all-users']`. El superusuario no puede resetearse a sí mismo (validación en UI).

### Ruta `/cambiar-contrasena`

- `src/app/pages/CambiarContrasenaPage.tsx` (lazy en `router.tsx`, standalone).
- Sin sesión -> redirect a `/login`.
- Formulario: nueva contraseña + confirmación.
- Al enviar: `supabase.auth.updateUser({ password })` -> limpiar flag
  `user_profile.must_change_password = false` (self-update, RLS existente) -> toast + navigate `/`.

### `AuthGate`

- Si `profileQuery.data?.must_change_password === true` y `pathname !== '/cambiar-contrasena'`,
  redirect a `/cambiar-contrasena` (antes del enrutado de tenant).

## Seguridad

- El único camino para resetear contraseñas es el edge function con service-role + verificación
  server-side de `is_platform_admin`.
- La contraseña no se registra en logs; `audit_log` guarda quién/cuándo/a quién.
- No se cambia ninguna política RLS existente; el acceso amplio del superusuario se deriva de
  sus membresías `tenant_admin`.

## Pruebas

`.test_admin_users.mjs`:

1. Backfill: el superusuario tiene membresía `tenant_admin` en todos los tenants.
2. Reset de contraseña de un usuario de prueba -> login con la nueva clave OK; con la vieja falla.
3. `forceChange` setea `must_change_password`; el usuario lo limpia con self-update.
4. Usuario no-super invoca `reset_password` -> 403.
5. `audit_log` registra el reset.
6. Regresión: `.test_attendance_capacity.mjs` sigue pasando.

## Verificación

`npm run lint` + `npm run build`.
