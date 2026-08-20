# Ficha de Historial Clínico + Exportación PDF

Fecha: 2026-08-17 · Estado: aprobado en diseño, pendiente de plan de implementación.

## Problema

El SRS (RF07) exige "Consultar historial clínico completo (solo Profesional asignado y
Administrador)" y el Flujo 6 define una vista con joins sobre `session`, `anamnesis`,
`diagnosis`, `treatment_plan`, `progress_note`, `assessment_result`. Hoy la data clínica
existe y es completa, pero vive dispersa y centrada en la sesión dentro de SesionesPage:
no hay ninguna vista consolidada del historial clínico por paciente, ni un documento
generable. `PacientesPage` solo lista/edita pacientes.

## Decisiones de diseño (aprobadas en diálogo)

- **Forma**: ficha clínica digital navegable en la app + exportación a PDF.
- **Visibilidad**: el profesional ve solo sus propias sesiones del paciente; el
  Administrador ve el historial completo. Coherente con la RLS actual
  (`session_select_clinical` = `professional_id = auth.uid() OR tenant_admin`).
- **PDF**: `window.print()` con CSS `@media print` (cero dependencias nuevas; el
  navegador ofrece "Guardar como PDF").

## Alcance

Dentro:
- Página `/pacientes/:patientId` con la ficha clínica del paciente.
- Auditoría de acceso al historial (Flujo 6 / RN13) vía RPC `log_clinical_history_access`.
- Botón "Generar PDF" (print).
- Acceso "Ver historial" desde PacientesPage.

Fuera (YAGNI):
- Portal del paciente / historial resumido (RF07b, RF30) — feature aparte.
- Cambios de esquema (no hay tablas nuevas).
- Librería de PDF, concepto de "profesional asignado", edición desde la ficha.

## Arquitectura

### Datos
Sin tablas nuevas. El hook `useClinicalHistory(tenantId, patientId)` consulta:

```
session
  .select(`
    *,
    appointment(service(name), scheduled_at, status, attendance),
    anamnesis(*),
    progress_note(*),
    diagnosis(*),
    treatment_plan(*),
    assessment_result(*),
    risk_alert(*)
  `)
  .eq('tenant_id', tenantId)
  .eq('patient_id', patientId)
  .order('started_at', { ascending: false })
```

La RLS existente sobre cada tabla clínica filtra las filas por rol: el profesional solo
recibe sus propias sesiones (y sus embeds clínicos); el admin las recibe todas. No hay
filtrado en cliente por rol, solo el derivado de la RLS.

### Auditoría de acceso
RPC `log_clinical_history_access(p_tenant_id uuid, p_patient_id uuid)` security definer:

1. Verifica membresía activa con rol `professional` o `tenant_admin` en el tenant.
2. Verifica que el paciente pertenezca al tenant.
3. Inserta en `audit_log` (`action = 'CLINICAL_HISTORY_ACCESS'`,
   `record_id = patient_id`, `metadata` con roles del usuario).

La ficha la invoca best-effort (no bloqueante) al cargar.

### UI — HistorialClinicoPage
Layout según design system (`.interface-design/system.md`): títulos
`text-2xl font-semibold tracking-tight`, KpiCards, EmptyState, badges.

Secciones (ordenadas cronológicamente, sesión más reciente primero):

1. **Cabecera del paciente**: nombre, NHC, documento, edad, estado; badge de alertas
   de riesgo activas. Con botón volver a Pacientes.
2. **Resumen**: total de sesiones, sesiones en curso, notas sin firmar.
3. **Línea de sesiones** — por cada sesión visible:
   - Encabezado: fecha, servicio, profesional, estado de sesión.
   - Anamnesis: motivo de consulta, antecedentes personales/familiares, historia del
     problema, evaluación de riesgo (mismo patrón `Field` de SesionesPage).
   - Notas SOAP: subjetivo/objetivo/análisis/plan; badge "Firmada" (con fecha) o
     "Sin firmar"; adendas agrupadas bajo la nota original (`addendum_of`).
   - Diagnósticos: código CIE-11 + etiqueta + descripción; badge "Primario".
   - Plan de tratamiento: objetivos, frecuencia sugerida, fechas, estado.
   - Escalas: escala, puntaje, severidad, fecha; minigráfico SVG (sin dependencias)
     de evolución temporal del puntaje por escala (RF24).
   - Alertas de riesgo: nivel, descripción, estado activa/resuelta.
4. **Botón "Generar PDF"** → `window.print()`.

Acceso: rol clínico (professional/tenant_admin) ve la ficha completa. Receptionista ve
la cabecera del paciente (data no clínica) y un aviso "Solo profesionales y
administradores acceden al historial clínico".

### Exportación (print)
- Clases `print:hidden` en sidebar/nav/acciones de AppShell y botones.
- La ficha se imprime full-width; `break-inside: avoid` en bloques; salto de página
  entre sesiones. Reglas en `src/index.css` bajo `@media print`.

## Error handling
- RPC de auditoría falla silenciosamente (best-effort, toast de warning opcional).
- Sin sesiones visibles → EmptyState "Sin historial clínico para mostrar".
- Paciente inexistente/ajeno al tenant → la query devuelve vacío; se muestra aviso.

## Testing
`.test_historial_clinico.mjs` (fase normal, sin promoción):
1. Pro consulta la ficha: solo recibe sus propias sesiones del paciente.
2. Admin consulta la ficha: recibe todas las sesiones del paciente.
3. Pro no recibe sesiones de otro profesional para el mismo paciente.
4. Pro no recibe `progress_note`/`anamnesis` de sesión ajena vía embeds.
5. `log_clinical_history_access` inserta fila en `audit_log` (pro y admin).
6. RPC rechaza a usuario sin rol clínico / paciente de otro tenant.

Regresiones: suite existente (`.test_payment_config.mjs`, `.test_caja_cobros.mjs`,
`.test_attendance_capacity.mjs`, `.test_signature_addendum_risk.mjs`,
`.test_platform_admin.mjs`, `.test_admin_users.mjs`).

## Fuera de alcance (futuro)
- Portal del paciente (RF28–RF31) y su historial resumido.
- Exportación server-side o librería PDF si se requiere descarga directa .pdf.
- Edición clínica desde la ficha (se mantiene en SesionesPage).
