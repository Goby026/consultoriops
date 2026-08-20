# Plan de Desarrollo — ConsultorioPS (SaaS Consultorio Psicológico)

Seguimiento de fases, estado de implementación y pendientes del SRS
`RequerimientosSoftware_Consultorio_Psicologico_SaaS_V0_5_formateado.md`.
Última actualización: 2026-08-26.

## Resumen de estado

| Área | Estado |
| --- | --- |
| Núcleo multi-tenant, identidad y seguridad (RF-SaaS01–07, RF01–03d) | ✅ Completado |
| Configuración del consultorio (RF-CON01–07, CON10–12, CON15) | ✅ Completado (faltan CON08 y CON09) |
| Pacientes y consentimiento (RF04–10) | ✅ Completado |
| Citas y agenda (RF11–18) | ✅ Completado |
| Atención clínica (RF19–27) | ✅ Completado |
| Portal del paciente (RF28–31) | ✅ Completado |
| Plataforma / superusuario (RF-SaaS08, SaaS11) | 🟡 Parcial (falta suspensión operativa) |
| Pendientes SRS | ⏳ RF-CON08, RF-CON09, RF-CON13 (versiones), RF-CON14, RN00e |

Leyenda: ✅ implementado y verificado · 🟡 parcial · ⏳ pendiente.

## Fases

### Fase 0 — Scaffolding (2026-08-09)
- ✅ Vite + React + TS + Tailwind + shadcn/ui; estructura `src/app`, `src/features`, `src/lib`.

### Fase 1 — Núcleo SaaS multi-tenant (2026-08-10)
- ✅ `tenant`, `tenant_membership`, `user_profile`, `role`, `audit_log`.
- ✅ RLS: `is_platform_admin`, `is_tenant_member`, `is_tenant_admin`, `is_tenant_staff`; aislamiento RN00.
- ✅ Login, selección de consultorio activo, `tenant_settings`, auditoría (`log_audit`).
- Migraciones: `20260810000100_base_schema.sql`, `20260810000200_config_schema.sql`,
  `20260810000300_fix_log_audit.sql`.

### Fase 2 — Configuración del consultorio (2026-08-10)
- ✅ Servicios y precios con snapshot histórico (`service_price`, `snapshot_service_price`).
- ✅ `clinic_schedule`, `professional_schedule`, `schedule_exception` con validación de solapamientos.
- ✅ `onboard_tenant` (Edge Function): alta de consultorio + admin + plantilla de consentimiento.

### Fase 3 — Pacientes y consentimiento (2026-08-12/13)
- ✅ `patient` (incluye `is_minor`), `legal_guardian` (RN11), `document_template`, `informed_consent`.
- ✅ N.º de historia clínica (`HCL-########` automático).
- Migraciones: `20260812000100_patients_consent.sql`, `20260813000100_patient_record_number.sql`.

### Fase 4 — Citas y agenda (2026-08-14)
- ✅ `appointment` con estados RN03, máximo de citas/día (RN02), solapamientos, snapshot de precio
  (RF-CON10/RN00d), reprogramación/cancelación (RN08), asistencia (RF18).
- ✅ Capacidad/asistencia (`20260820000100_attendance_capacity.sql`).
- Migraciones: `20260814000100_appointments.sql`, `20260820000100_attendance_capacity.sql`.

### Fase 5 — Atención clínica (2026-08-15/16/18/19)
- ✅ `session` (RN04/05), `anamnesis`, `progress_note` (SOAP), `diagnosis` (CIE-11), `treatment_plan`,
  `assessment_result` (escalas + evolución), `risk_alert` (RF27/RN12).
- ✅ Firma digital e inmutabilidad de notas (RF25/RN10) + adenda (RF26).
- ✅ Horarios propios del profesional (`20260817000100_professional_own_schedule.sql`).
- Migraciones: `20260815000100_sessions.sql`, `20260816000100_treatment_plan.sql`,
  `20260817000100_professional_own_schedule.sql`, `20260818000100_diagnosis_assessment.sql`,
  `20260819000100_signature_addendum_risk.sql`, `20260819000200_fix_signed_note_cascade.sql`.

### Fase 6 — Plataforma / superusuario (2026-08-21/22/25)
- ✅ Consola de plataforma `/plataforma`, alta/suspensión/bloqueo de tenants (`onboard_tenant`).
- ✅ Guarda de `is_platform_admin` (`user_profile_platform_admin_guard`, migración `20260825000200`).
- Migraciones: `20260821000100_superuser_platform.sql`, `20260822000100_platform_admin_elevated_access.sql`,
  `20260825000200_user_profile_platform_admin_guard.sql`.

### Fase 7 — Caja, cobros y planes de pago (2026-08-23/24)
- ✅ Métodos de pago y condiciones (`payment_method`, `payment_config`), planes de pago (`payment_plan`),
  cobros y caja (`payment`, `caja`).
- Migraciones: `20260823000100_payment_methods_plans.sql`, `20260824000100_caja_cobros.sql`.

### Fase 8 — Historial clínico (2026-08-25)
- ✅ Historial clínico integral con documentos en Storage (acceso por rol, solo profesional dueño + admin).
- Migración: `20260825000100_clinical_history.sql`.

### Fase 9 — Portal del paciente (2026-08-26)
- ✅ Vinculación por código (ficha o código general del consultorio), aislamiento RN07, cita con snapshot
  de precio, cancelación en ventana 24 h, historial resumido (RF30), consentimiento (RF31).
- ✅ Frontend `/portal` y `/portal/registro` (`PortalGate`, `PortalLayout`, páginas del portal).
- Migraciones: `20260826000100_patient_portal.sql`, `20260826000200_fix_patient_policies_hcl.sql`,
  `20260826000300_portal_list_professionals.sql`, `20260826000400_portal_redeem_by_code.sql`.

### Fase 10 — UX pública y shell (2026-08-26)
- ✅ Landing pública en `/`; app de gestión movida a `/app`.
- ✅ Rediseño del panel y shell estilo shadcnblocks Admin (sidebar colapsable, header con búsqueda y
  notificaciones, KPIs y feeds estilizados).

## Pendientes (backlog SRS)

| Ítem | RF | Notas |
| --- | --- | --- |
| Precios diferenciados | RF-CON08 | Precio según profesional/modalidad/duración/condición |
| Promociones | RF-CON09 | Vigencia, descuento, servicios, límites de uso |
| Plantillas con versionado | RF-CON13 | Hay plantilla de consentimiento; falta versionado |
| Feature flags por consultorio | RF-CON14 | Base para RF-SaaS12 |
| Suspensión operativa del tenant | RN00e / RF-SaaS08-09 | El estado se cambia, pero no bloquea operaciones |
| Auditoría de accesos clínicos | RN13 | Bitácora de escritura existe; falta registrar lecturas |

## Verificación

- Frontend: `npm run build` (typecheck + build) y `npm run lint` deben pasar limpios.
- Backend: suites `.test_*.mjs` (ver AGENTS.md para fases y restauración de `sessadmin`).