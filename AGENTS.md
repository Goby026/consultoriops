# AGENTS.md

Guía de contexto para agentes que trabajan en **ConsultorioPS**, una plataforma SaaS multi-tenant
para la gestión de consultorios psicológicos (SRS `RequerimientosSoftware_Consultorio_Psicologico_SaaS_V0_5_formateado.md`).

## Stack

- **Frontend**: React 19 + Vite 8 + TypeScript 6 + Tailwind CSS 4 + shadcn/ui + TanStack Query + react-router v7.
- **Backend**: Supabase (PostgreSQL + Auth + Storage + Edge Functions en Deno).
- **Lint**: Oxlint (`npm run lint`). No hay framework de tests configurado en npm; las pruebas son scripts Node ad-hoc (`.test_*.mjs`) que usan `@supabase/supabase-js` contra un proyecto vinculado.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Entorno de desarrollo con HMR |
| `npm run build` | Typecheck (`tsc -b`) + build de producción (debe pasar limpio) |
| `npm run lint` | Lint con Oxlint |
| `npm run preview` | Sirve el build de producción localmente |
| `node .test_*.mjs` | Suites de integración/backend (requieren `.env.local` + proyecto vinculado) |

## Estructura

```
src/
  app/            # router, providers, AppShell, páginas globales (login, landing, ...)
  features/       # módulos por dominio: auth, tenants, pacientes, citas, sesiones,
                  #   caja, configuracion, panel, plataforma, portal, theme
  components/ui/  # componentes shadcn/ui
  lib/            # supabaseClient.ts, database.types.ts, utils.ts
supabase/
  migrations/     # migraciones SQL numeradas por fecha (YYYYMMDDNNNNNN_*.sql)
  functions/      # Edge Functions (Deno) — onboard_tenant
```

Rutas principales: `/` (landing pública), `/login`, `/signup`, `/portal/registro`,
`/portal/*` (PortalGate), `/app/*` (app de gestión, AuthGate + AppShell),
`/plataforma` (consola del Administrador de Plataforma), `/select-tenant`, `/no-access`.

## Convenciones

- Texto de UI en **español**. Código (identificadores, comentarios si los hubiera) en inglés.
- **No añadir comentarios** al código salvo que se pidan.
- Seguir los patrones existentes (hooks `useX` por feature + react-query, componentes en `src/features/<feature>/components`).
- `database.types.ts` se regenera con `npx supabase gen types typescript --linked`; si se regenera,
  restaurar los exports con nombre al final del archivo (`Role`…`TreatmentPlan`, `Payment`, `PaymentMethod`,
  `PaymentPlan`, `AssessmentResult`, `Diagnosis`, `RiskAlert`).
- UI: Tailwind + tokens oklch en `src/index.css`; componentes shadcn/ui en `src/components/ui/`.
  Tema claro/oscuro con `next-themes`; paletas por usuario en `src/features/theme/`.

## Flujo Supabase (importante)

- Las migraciones van en `supabase/migrations/` con nombre `YYYYMMDDNNNNNN_<descripcion>.sql` y se aplican con
  `supabase db push`. Tras aplicar, recargar esquema PostgREST:
  `supabase db query --linked "notify pgrst, 'reload schema';"`.
- **Seguridad crítica — NO insertar filas directamente en `auth.users`** (rompe el login de GoTrue:
  "Database error querying schema"). Los usuarios de prueba deben crearse con `auth.admin.createUser`
  (por ejemplo vía un edge function temporal con service role).
- La configuración sensible (promover `is_platform_admin`, etc.) se hace por CLI/Postgres, **no** desde el
  frontend: un trigger (`user_profile_platform_admin_guard`) bloquea cambios de `is_platform_admin` salvo
  platform admin, service role o contexto de servidor.
- RLS obligatoria en tablas de negocio. El tenant se deriva de la membresía autenticada
  (`is_tenant_member`, `is_tenant_admin`, etc.), nunca de un valor confiado al frontend.
- Edge Functions: `supabase functions deploy onboard_tenant` (crea consultorios desde la consola de plataforma).

## Pruebas

- Suites en la raíz (`.test_*.mjs`): se ejecutan con `node` y leen `.env.local`.
- Cada suite limpia sus datos al final (borra pacientes/citas de prueba). Si una corrida falla a mitad,
  revisar datos residuales.
- **Fases**: `.test_platform_admin.mjs` y `.test_admin_users.mjs` **requieren** que el usuario `sessadmin`
  esté promovido (`is_platform_admin = true` vía CLI) y lo dejan degradado después.
  `.test_user_profile_guard.mjs` usa `PHASE=normal|promoted`. Correr `platform_admin` sin promoción degrada
  la membresía de `sessadmin` a `patient` y rompe en cascada otras suites; restaurar con:
  `supabase db query --linked "update public.tenant_membership set role_id = (select id from public.role where code='tenant_admin') where user_id = '<sessadmin>';"`
- Estado verificado de la base de prueba: 1 platform admin (`george.rendich@gmail.com`), `sessadmin` = `tenant_admin`.

## Documentación

- `docs/superpowers/specs/` — diseños aprobados por feature (fechados `YYYY-MM-DD-<tema>-design.md`).
- `docs/superpowers/backlog.md` — incidencias/decisiones conocidas.
- `PLAN_DESARROLLO.md` — fases y estado de implementación de requerimientos.
- El SRS es la fuente de verdad de requerimientos (RF/RFN/RN); reflejar ahí el estado de implementación.

## Roles de acceso (resumen)

- `platform_admin` → consola `/plataforma`.
- `tenant_admin` → gestión completa de su consultorio.
- `professional` → atención clínica y firma; único rol que firma notas.
- `receptionist` → pacientes y citas; **sin** contenido clínico.
- `patient` → portal `/portal` (solo su propia información, forma resumida; RN07).