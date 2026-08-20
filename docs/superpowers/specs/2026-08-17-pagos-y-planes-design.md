# Pagos y Planes — Diseño

- **Fecha**: 2026-08-17
- **Alcance**: RF-CON11 (métodos de pago aceptados), RF-CON12 (planes de pago del consultorio), RF13 (gestionar planes de pago).
- **Fuera de alcance**: registro de cobros/pagos sobre citas (se hará en una iteración posterior sobre `service_price` y `appointment`).

## Contexto

El sistema hoy configura servicios y precios históricos (`service`, `service_price`), pero no tiene métodos de pago ni planes de pago propios del consultorio. Este bloque agrega solo la **configuración** (CRUD), reutilizando los patrones existentes de RLS, auditoría, triggers y hooks de queries de configuración.

## Decisiones acordadas

- Alcance: solo configuración. No se registran cobros sobre citas.
- Un `payment_plan` es un **paquete de sesiones**: nombre, cantidad de sesiones, precio del pack y vigencia opcional. El precio por sesión se deriva en UI (`price / sessions_included`), no se almacena.
- `payment_method` sin condiciones estructuradas: solo nombre, categoría, estado y orden (YAGNI; se puede ampliar después).
- Un plan NO se relaciona con servicios específicos por ahora.

## Modelo de datos

Migración `supabase/migrations/20260823000100_payment_methods_plans.sql`.

### `payment_method`

| Columna     | Tipo                    | Reglas                                            |
|:------------|:------------------------|:--------------------------------------------------|
| `id`        | uuid PK                 | `default gen_random_uuid()`                       |
| `tenant_id` | uuid NOT NULL           | FK `tenant(id) on delete cascade`                 |
| `name`      | text NOT NULL           | `unique(tenant_id, name)`                         |
| `category`  | text NOT NULL           | `default 'OTRO'`, `check in ('EFECTIVO','TARJETA','TRANSFERENCIA','OTRO')` |
| `active`    | boolean NOT NULL        | `default true`                                    |
| `sort_order`| int NOT NULL            | `default 0`                                       |
| `created_at`| timestamptz NOT NULL    | `default now()`                                   |
| `updated_at`| timestamptz NOT NULL    | `default now()`, trigger `set_updated_at()`       |

### `payment_plan`

| Columna            | Tipo             | Reglas                                       |
|:-------------------|:-----------------|:---------------------------------------------|
| `id`               | uuid PK          | `default gen_random_uuid()`                  |
| `tenant_id`        | uuid NOT NULL    | FK `tenant(id) on delete cascade`            |
| `name`             | text NOT NULL    | `unique(tenant_id, name)`                    |
| `description`      | text NULL        |                                              |
| `sessions_included`| int NOT NULL     | `check (sessions_included > 0)`              |
| `price`            | numeric(10,2) NOT NULL | `check (price >= 0)`                   |
| `valid_from`       | date NULL        |                                              |
| `valid_to`         | date NULL        |                                              |
| `active`           | boolean NOT NULL | `default true`                               |
| `sort_order`       | int NOT NULL     | `default 0`                                  |
| `created_at`       | timestamptz NOT NULL | `default now()`                           |
| `updated_at`       | timestamptz NOT NULL | `default now()`, trigger `set_updated_at()` |

Índice en `tenant_id` para ambas tablas (`idx_payment_method_tenant`, `idx_payment_plan_tenant`).

### RLS (mismo patrón que `service`)

| Política                        | Condición                                                    |
|:--------------------------------|:-------------------------------------------------------------|
| `payment_method_select_member`  | `public.is_tenant_member(tenant_id)`                         |
| `payment_method_insert_tenant_admin` | `with check (public.has_role_in_tenant(tenant_id, array['tenant_admin']))` |
| `payment_method_update_tenant_admin` | `using + with check` igual que insert                       |
| `payment_method_delete_tenant_admin` | `using` igual que insert                                    |
| `payment_plan_*`                | Mismas 4 políticas con los mismos helpers                    |

`has_role_in_tenant` ya reconoce al Administrador de Plataforma (migración `20260822000100`), por lo que el superusuario puede administrar métodos y planes en cualquier consultorio sin membresía `tenant_admin`.

### Auditoría (RF-CON15)

Triggers `trg_audit_payment_method` y `trg_audit_payment_plan` (before insert/update/delete) → `public.log_audit()`, igual que `service`.

## UI — pestaña "Pagos y planes"

Archivos nuevos en `src/features/configuracion/`:

- `hooks/usePayments.ts`: `usePaymentMethods(tenantId)` y `usePaymentPlans(tenantId)` con patrón `useQuery` + `.eq('tenant_id', ...)` + `.order('sort_order').order('name')`.
- `components/PagosPlanesTab.tsx`: dos Cards.
  - **Métodos de pago**: formulario agregar (nombre + categoría select) y tabla (nombre, badge de categoría, toggle `active`, eliminar con confirmación).
  - **Planes de pago**: botón "Nuevo plan" → diálogo crear/editar (nombre, descripción, sesiones, precio, vigencia desde/hasta, activo) y tabla (nombre, sesiones, precio pack, precio/sesión derivado, vigencia, toggle, editar, eliminar).
- Mutaciones con `useMutation` + `invalidateQueries(['payment_methods', tenantId] | ['payment_plans', tenantId])`, `toast` de éxito/error (patrón `ServiciosTab`/`ProfesionalesTab`).

Integración: agregar `{ id: 'pagos-planes', label: 'Pagos y planes' }` a `ADMIN_TABS` en `ConfiguracionPage.tsx` y renderizar `{activeTab === 'pagos-planes' && <PagosPlanesTab key={activeTenantId} tenantId={activeTenantId} />}`. Solo visible para admin (los tabs no-admin no la incluyen).

### Tipos

Agregar `PaymentMethod` y `PaymentPlan` a `src/lib/database.types.ts` (tablas `payment_method` y `payment_plan` con `Relationships` a `tenant`), siguiendo el formato existente.

## Pruebas

`.test_payment_config.mjs` (consume anon + RLS, patrón de los tests existentes):

1. Admin (`sessadmin`) inserta método y plan en San Lucas → OK.
2. Admin actualiza plan (precio/sesiones) → OK; elimina método → OK.
3. Profesional (`sesspro`) NO puede insertar método ni eliminar plan (RLS) → error esperado.
4. Aislamiento: `sessadmin` NO puede insertar un método con `tenant_id` de otro consultorio (con check `has_role_in_tenant` lo impide) → error esperado.
5. Superusuario (sessadmin promovido temporalmente vía CLI, con membresía propia en `patient`) puede insertar un plan → OK (regresión del desacople).
6. Restaurar membresía de sessadmin y revocar la promoción; limpiar registros creados.

Regresión: `.test_admin_users.mjs`, `.test_attendance_capacity.mjs`, `.test_signature_addendum_risk.mjs`, `.test_platform_admin.mjs`. Luego `npm run lint` y `npm run build`.

## Verificación de éxito

- `npx supabase db push` aplica la migración sin errores.
- Nuevo test 6/6 PASS y regresiones intactas.
- lint limpio (solo warnings preexistentes) y build OK.
- Como admin, la pestaña "Pagos y planes" permite crear/editar/activar/eliminar métodos y planes; como profesional no aparece la pestaña.