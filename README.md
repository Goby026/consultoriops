# ConsultorioPS — Gestión de Consultorio Psicológico (SaaS multi-tenant)

Plataforma SaaS para la gestión de consultorios psicológicos, según el SRS
`RequerimientosSoftware_Consultorio_Psicologico_SaaS_V0_5_formateado.md`.

Stack: React + Vite + TypeScript + Tailwind CSS + Shadcn/ui + TanStack Query + Supabase.

## Requisitos

- Node.js 20+
- Proyecto en [Supabase](https://supabase.com) (URL y anon key)
- Cuenta en [Vercel](https://vercel.com) para el despliegue

## Configuración inicial

### Vía CLI (recomendada)

1. Copia `.env.example` a `.env.local` y completa las variables
   (`Settings → API` de tu proyecto Supabase).

2. Instala el CLI y vincula tu proyecto:

   ```sh
   npm install -g supabase
   supabase login --token <tu-access-token>
   supabase link --project-ref <tu-project-ref>
   ```

3. Aplica la migración y despliega la Edge Function:

   ```sh
   supabase db push
   supabase functions deploy onboard_tenant
   ```

4. **Bootstrap del Administrador de Plataforma.** Tras crear la primera cuenta
   en el login, márcala como admin (una sola vez):

   ```sh
   supabase db query --linked "update public.user_profile set is_platform_admin = true where email = 'tu@correo.com';"
   ```

5. Verifica el aislamiento multi-tenant ejecutando
   `supabase/tests/verify_rls_isolation.sql` en el SQL Editor.
6. `npm install && npm run dev`

### Vía dashboard (manual)

1. Copia `.env.example` a `.env.local` y completa las variables
   (`Settings → API` de tu proyecto Supabase).
2. Pega el contenido de `supabase/migrations/20260810000100_base_schema.sql`
   en el **SQL Editor** y ejecuta.
3. Registra la Edge Function `supabase/functions/onboard_tenant`.
4. Bootstrap del primer admin (vía SQL Editor):

   ```sql
   update public.user_profile
   set is_platform_admin = true
   where email = 'tu@correo.com';
   ```

5. Verifica el aislamiento multi-tenant ejecutando
   `supabase/tests/verify_rls_isolation.sql` en el SQL Editor.
6. `npm install && npm run dev`

## Scripts

| Comando            | Descripción                                   |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Entorno de desarrollo con HMR                 |
| `npm run build`    | Typecheck (`tsc -b`) + build de producción    |
| `npm run lint`     | Lint con Oxlint                               |
| `npm run preview`  | Sirve el build de producción localmente       |

## Estructura

```
src/
  app/            # rutas, providers y shell de la aplicación
  features/       # módulos por dominio: auth, tenants, pacientes, citas, ...
  shared/         # componentes y utilidades comunes
  lib/
    supabaseClient.ts
    database.types.ts   # tipado del esquema (regenerar con `supabase gen types`)
supabase/
  migrations/     # migraciones SQL (aplicar en Supabase)
  functions/      # Edge Functions (Deno)
```

## Fases de desarrollo

- **Fase 0 (completada):** scaffolding, UI kit y estructura de carpetas.
- **Fase 1 (en curso):** núcleo multi-tenant: `tenant`, `tenant_membership`,
  `user_profile`, `role`, `audit_log`, funciones RLS y flujo de login +
  selección de consultorio.
- **Fase 2+:** configuración del consultorio, pacientes y consentimiento,
  citas y agenda, atención clínica. Ver plan en el SRS §12.
