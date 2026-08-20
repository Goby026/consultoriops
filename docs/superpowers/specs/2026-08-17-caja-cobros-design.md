# Caja y Cobros — Diseño

- **Fecha**: 2026-08-17
- **Alcance**: registro de cobros de citas/sesiones (Nivel 1 del control económico). Complementa RF-CON10/RF-CON11/RF-CON12/RF13 y RN00d.
- **Fuera de alcance**: facturación electrónica (SRS 1.3), contabilidad (partida doble/P&L) y honorarios/comisión por profesional.

## Contexto

`appointment.price` ya guarda la fotografía del precio del servicio al agendar (trigger `BEFORE INSERT`, migración `20260814000100`) y existen `payment_method`/`payment_plan` (solo configuración). No existe ningún registro de cobro: no hay tabla, no hay estado de pago ni reportes. Este módulo agrega el registro de cobros con pagos parciales y saldo derivado.

## Decisiones acordadas

- Nivel 1: registro de cobros + saldos + reportes de ingresos y cuentas por cobrar.
- Permisos: `professional` cobra **solo sus propias citas**; `tenant_admin` y `receptionist` cobran cualquier cita. El profesional consulta solo lo suyo.
- Pagos parciales: un cobro por fila; saldo de la cita = `appointment.price − Σ payments`. Se permiten abonos sucesivos hasta completar el precio (no sobrepagar).
- Cobro permitido sobre cualquier cita **no cancelada** (`PROGRAMADA`, `ATENDIDA`, `NO_ASISTIO`, `REPROGRAMADA`).
- Pagos **inmutables** (sin update). Corrección = delete (solo `tenant_admin`, auditado).
- Sin Edge Function: RLS (autorización) + trigger (integridad), patrón de sesiones.

## Modelo de datos

Migración `supabase/migrations/20260824000100_caja_cobros.sql`.

### `payment`

| Columna              | Tipo             | Reglas                                        |
|:---------------------|:-----------------|:----------------------------------------------|
| `id`                 | uuid PK          | `default gen_random_uuid()`                   |
| `tenant_id`          | uuid NOT NULL    | FK `tenant(id) on delete cascade`             |
| `appointment_id`     | uuid NOT NULL    | FK `appointment(id) on delete cascade`        |
| `amount`             | numeric(10,2) NOT NULL | `check (amount > 0)`                    |
| `payment_method_id`  | uuid NULL        | FK `payment_method(id) on delete set null`    |
| `paid_at`            | timestamptz NOT NULL | `default now()`                           |
| `notes`              | text NULL        |                                               |
| `recorded_by`        | uuid NULL        | FK `auth.users(id) on delete set null`, `default auth.uid()` |
| `created_at`         | timestamptz NOT NULL | `default now()`                           |
| `updated_at`         | timestamptz NOT NULL | `default now()`, trigger `set_updated_at()` |

Índices: `idx_payment_tenant_date (tenant_id, paid_at)`, `idx_payment_appointment (appointment_id)`.

### Trigger `validate_payment()` (before insert or update)

- `appointment_id` existe.
- La cita pertenece al **mismo tenant** que el cobro (`appointment.tenant_id = payment.tenant_id`).
- La cita **no está CANCELADA**.
- `amount ≤ saldo restante` (`appointment.price − Σ payments de la cita, excluyendo el propio registro en update`); rechaza sobrepago con error claro.
- Se usa `security definer` (como los demás triggers de validación) para leer `appointment` y los pagos previos.

### RLS

| Política | Condición |
|:---------|:----------|
| `payment_select_member` | `public.is_tenant_member(tenant_id)` AND (es `tenant_admin`/`receptionist` OR la cita es propia): `exists (select 1 from appointment a where a.id = appointment_id and (a.professional_id = auth.uid() or public.has_role_in_tenant(tenant_id, array['tenant_admin','receptionist'])))` |
| `payment_insert_member` | `with check`: `public.has_role_in_tenant(tenant_id, array['tenant_admin','receptionist'])` OR (`public.has_role_in_tenant(tenant_id, array['professional'])` AND `exists (select 1 from appointment a where a.id = appointment_id and a.professional_id = auth.uid())`) |
| `payment_delete_tenant_admin` | `using (public.has_role_in_tenant(tenant_id, array['tenant_admin']))` |
| (sin update) | — |

Nota: `has_role_in_tenant` ya reconoce al superusuario (`20260822000100`), por lo que puede cobrar/eliminar en cualquier tenant.

### Auditoría (RN00d/RF-CON15)

Trigger `trg_audit_payment` → `public.log_audit()`.

## UI — página "Caja" (`src/features/caja/`)

- Ruta `/caja` (dentro de `AppShell`) + ítem de navegación `{ to: '/caja', label: 'Caja', icon: Banknote }`.
- `components/CajaPage.tsx`:
  - **Resumen**: total ingresos del periodo filtrado, nº de cobros, total pendiente.
  - **Registrar cobro**: `Select` de paciente → lista sus citas elegibles (no canceladas, saldo > 0, visibles según permiso) con saldo restante → monto (default = saldo restante), método (`payment_method` activos), notas → insert.
  - **Cobros**: tabla filtrable por rango de fechas, profesional y servicio: fecha, paciente, profesional, servicio, monto, método, saldo restante de la cita, eliminar (solo admin).
  - **Cuentas por cobrar**: resumen por paciente del saldo pendiente total.
- `hooks/usePayments.ts`: `useAppointmentsForCaja(tenantId)` y `usePayments(tenantId)` (queries paralelas de React Query, `async-parallel`); saldos calculados en `useMemo` con `Map` por `appointment_id` (`js-index-maps`). Mutaciones insert/delete con invalidación.
- Se reutiliza el patrón de consulta de citas de `useAppointments` (joins a paciente/profesional/servicio) para nombres.

## Tipos

Agregar `Payment` a `src/lib/database.types.ts` (tabla `payment` con `Relationships` a `tenant`, `appointment`, `payment_method`).

## Pruebas

`.test_caja_cobros.mjs` (anon + RLS, patrón existente):

1. Admin inserta cobro (monto parcial) → OK; saldo derivado correcto (`price − monto`).
2. Abono sucesivo completa el precio → OK; **sobrepago rechazado** por el trigger.
3. Profesional inserta cobro sobre **su propia** cita → OK.
4. Profesional NO puede cobrar la cita de otro profesional → error RLS.
5. Cita **CANCELADA**: cobro rechazado por el trigger.
6. Delete: admin puede; profesional NO.
7. Aislamiento: cobro con `tenant_id` distinto al de la cita → rechazado (trigger).
8. Superusuario (sessadmin promovido vía CLI, membresía `patient`) puede cobrar cualquier cita → OK (regresión del desacople). Restaurar membresía y revocar promoción.

Regresión: `.test_payment_config.mjs`, `.test_platform_admin.mjs`, `.test_admin_users.mjs`, `.test_attendance_capacity.mjs`, `.test_signature_addendum_risk.mjs`. Luego `npm run lint` y `npm run build`.

## Verificación de éxito

- `npx supabase db push` aplica la migración sin errores.
- Nuevo test 8/8 PASS y regresiones intactas.
- lint limpio (solo warnings preexistentes) y build OK.
- Como admin/recepcionista/profesional, la página Caja registra cobros, muestra saldos y cuentas por cobrar correctamente.