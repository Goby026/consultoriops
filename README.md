# ConsultorioPS — Gestión de Consultorio Psicológico (SaaS multi-tenant)

Plataforma SaaS para la gestión de consultorios psicológicos, según el SRS
`RequerimientosSoftware_Consultorio_Psicologico_SaaS_V0_5_formateado.md`.

Stack: React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + shadcn/ui + TanStack Query + react-router v7 + Supabase.

## Estado de implementación

Núcleo multi-tenant, seguridad, configuración del consultorio, pacientes, consentimiento, citas,
atención clínica (firma/adenda/riesgo), caja y planes de pago, historial clínico y portal del paciente
están **implementados y verificados**. Pendientes del SRS: promociones (RF-CON09), precios diferenciados
(RF-CON08), versionado de plantillas (RF-CON13), feature flags (RF-CON14) y suspensión operativa del
tenant (RN00e). Ver detalle por requerimiento en `PLAN_DESARROLLO.md` y la sección 1.4 del SRS.

### Funcionalidades principales

- **Multi-tenant**: consultorios aislados por RLS, membresías con rol, selección de consultorio activo.
- **Configuración**: datos institucionales, profesionales, horarios generales/individuales y excepciones,
  servicios y precios (con snapshot histórico), métodos y planes de pago.
- **Pacientes y consentimiento**: ficha con N.º de HCL automático, representante legal para menores,
  consentimiento informado firmado (bloquea la primera sesión si no está vigente).
- **Citas y agenda**: disponibilidad, máximo por día, solapamientos, reprogramación, cancelación y asistencia.
- **Atención clínica**: sesiones, anamnesis, notas SOAP, diagnóstico (CIE-11), plan de tratamiento,
  escalas (PHQ-9/GAD-7), firma digital con adenda y alertas de riesgo.
- **Caja y cobros**: cobros, pagos parciales y planes de pago.
- **Historial clínico**: vista integral con documentos adjuntos en Storage (acceso por rol).
- **Portal del paciente**: vinculación por código, solicitud de citas, historial resumido (solo su
  información, forma resumida) y firma de consentimiento.
- **Plataforma**: consola del Administrador de Plataforma con alta de consultorios.
- **Landing pública** en `/` y app de gestión en `/app` (rediseño del panel estilo shadcnblocks Admin).

## Requisitos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com) (URL y anon key)
- CLI de Supabase vinculado al proyecto

## Configuración inicial

1. Copia `.env.example` a `.env.local` y completa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.

2. Vincula tu proyecto y aplica las migraciones:

   ```sh
   supabase login --token <tu-access-token>
   supabase link --project-ref <tu-project-ref>
   supabase db push
   supabase functions deploy onboard_tenant
   ```

3. **Bootstrap del Administrador de Plataforma** (una sola vez, por CLI — el frontend no puede
   auto-promoverse):

   ```sh
   supabase db query --linked "update public.user_profile set is_platform_admin = true where email = 'tu@correo.com';"
   ```

4. Tras aplicar migraciones, recarga el esquema PostgREST:

   ```sh
   supabase db query --linked "notify pgrst, 'reload schema';"
   ```

5. `npm install && npm run dev`

## Scripts

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
  app/            # router, providers, AppShell, páginas globales (landing, login, ...)
  features/       # módulos por dominio: auth, tenants, pacientes, citas, sesiones,
                  #   caja, configuracion, panel, plataforma, portal, theme
  components/ui/  # componentes shadcn/ui
  lib/            # supabaseClient.ts, database.types.ts, utils.ts
supabase/
  migrations/     # migraciones SQL numeradas por fecha (YYYYMMDDNNNNNN_*.sql)
  functions/      # Edge Functions (Deno) — onboard_tenant
```

Rutas principales: `/` (landing pública), `/login`, `/signup`, `/portal/registro`, `/portal/*`,
`/app/*` (app de gestión), `/plataforma`, `/select-tenant`, `/no-access`.

## Pruebas

- Suites ad-hoc en la raíz (`.test_*.mjs`) ejecutadas con `node`; cada una limpia sus datos al final.
- Algunas suites requieren fases especiales (ver `AGENTS.md`).
- `database.types.ts` se regenera con `npx supabase gen types typescript --linked`.

## Documentación

- `PLAN_DESARROLLO.md` — fases y estado de implementación de requerimientos.
- `docs/superpowers/specs/` — diseños aprobados por feature.
- `docs/superpowers/backlog.md` — incidencias/decisiones conocidas.
- `AGENTS.md` — guía de contexto para agentes/IA que trabajan en el repo.