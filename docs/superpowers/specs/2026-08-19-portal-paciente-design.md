# Portal del Paciente (RF28–RF31)

Fecha: 2026-08-19 · Estado: aprobado en diseño, pendiente de plan de implementación.

## Problema

El SRS define un bloque completo de Portal del Paciente (RF28–RF31) y el historial
resumido (RF07b/RF30) que no existe. Hoy los pacientes son entidades administrativas
gestionadas por el staff (`patient` sin `user_id`), las citas y los consentimientos se
insertan solo por staff, las sesiones clínicas son ilegibles para el paciente por RLS,
y el enrutado asume que todo usuario con membresía es staff.

El portal debe permitir: registrarse como paciente (RF28), solicitar cita (RF29), ver
historial resumido (RF30/RF07b) y ver/firmar consentimiento (RF31), respetando el
aislamiento por tenant (RN00) y que el paciente solo ve su propia información (RN07).

## Decisiones de diseño (aprobadas en diálogo)

- **Vinculación por código**: el consultorio entrega un código al paciente. Código
  **por ficha** (`patient.access_code`, generado por el staff) como mecanismo principal;
  código **general por consultorio** (`tenant.patient_signup_code`) como respaldo que
  matchea por DNI+email o crea la ficha.
- **Enfoque backend**: RPC `security definer` + políticas RLS (sin edge functions nuevas).
- **Cita auto-confirmada**: la solicitud del paciente crea la cita `PROGRAMADA`
  inmediatamente (valida RN01/RN02 con el trigger existente).
- **Cancelación**: solo el propio paciente, cita futura `PROGRAMADA`/`REPROGRAMADA`, y
  únicamente dentro de las **24 horas posteriores a su creación**; después queda
  confirmada y no se puede cancelar.
- **Historial resumido**: solo sesiones (fecha, servicio, profesional, estado). Sin
  anamnesis, SOAP, diagnósticos, escalas ni alertas (RN12/RN07).
- **Consentimiento**: aceptación electrónica (leer plantilla vigente + aceptar); sin
  subida de archivo. Cuenta para RN09.
- **Aislamiento estricto**: el rol `patient` solo ve sus propios datos; se restringen las
  policies `select` "member" existentes a roles staff.

## Alcance

Dentro:
- Migración de base del portal (vínculo usuario↔ficha, códigos, RLS, RPCs).
- Registro/canje de código (RF28).
- Solicitar y cancelar cita (RF29 + regla de 24 h).
- Historial resumido (RF30/RF07b).
- Consentimiento electrónico (RF31).
- Layout y rutas del portal con gating por rol.
- Endurecimiento RLS para rol patient.

Fuera (YAGNI):
- Pagos desde el portal (los cobros siguen en caja).
- Reprogramación por el paciente.
- Notificaciones por email/WhatsApp.
- Portal por subdominio (solo ruta `/portal`).
- Documento PDF firmado subido por el paciente (la aceptación es electrónica).

## Arquitectura

### Datos (migración `20260826000100_patient_portal.sql`)

- `patient.user_id uuid` nullable → `auth.users(id)` `on delete set null`; índice parcial
  único `(tenant_id, user_id) where user_id is not null` (un usuario puede ser paciente en
  varios consultorios).
- `patient.access_code text` (único, nullable) + `patient.access_code_expires_at` —
  generado/regenerado por staff desde la ficha.
- `tenant.patient_signup_code text` — código general de respaldo.
- Políticas RLS nuevas/ajustadas:
  - `patient_select_self`: `user_id = auth.uid()`.
  - Restringir `patient_select_member`, `appointment_select_member`,
    `informed_consent_select_member` a roles staff (`tenant_admin`, `professional`,
    `receptionist`) vía `has_role_in_tenant`.
  - `appointment_select_self_patient` y `appointment_insert_self_patient`
    (`exists(patient where user_id = auth.uid() and id = appointment.patient_id and
    tenant_id = appointment.tenant_id)` y `created_by = auth.uid()`).
  - `informed_consent_select_self` (own).
  - `document_template` se mantiene legible para miembros (el paciente debe leer el texto
    de la plantilla vigente).

### RPCs (`security definer`, `set search_path = public`)

- `redeem_patient_code(p_tenant_id uuid, p_code text, p_identity jsonb)`:
  1. `auth.uid()` obligatorio; tenant activo (no suspendido).
  2. Si `p_code` es un `patient.access_code` del tenant → vincula esa ficha exacta.
  3. Si es `tenant.patient_signup_code` → matchea una ficha existente del tenant por
     `identity_doc_type + identity_doc_number + email` (todos presentes), o la crea con
     `p_identity` (activa el `medical_record_number` automático).
  4. Inserta `tenant_membership` rol `patient` (status active) si no existe.
- `generate_patient_code(p_patient_id uuid)`: staff/tenant_admin regenera el código.
- `cancel_own_appointment(p_appointment_id uuid)`: valida cita propia, futura, estado
  `PROGRAMADA`/`REPROGRAMADA`, y `now() <= created_at + interval '24 hours'`; pasa a
  `CANCELADA`. Si pasó la ventana → excepción "cita confirmada".
- `get_patient_history_summary()`: devuelve solo sesiones del paciente autenticado
  (`started_at`, servicio, profesional, estado). No expone notas clínicas.
- `accept_consent()`: inserta `informed_consent` con la plantilla vigente
  (`code='informed_consent'`, activa, última versión), `accepted_by = auth.uid()`,
  `signed_at = now()`. Rechaza si ya hay una aceptación vigente.

### Frontend (`src/features/portal/`)

- Rutas: `/portal` (PortalLayout con nav: Inicio, Mis citas, Solicitar cita, Mi historial,
  Consentimiento) y `/portal/registro` (identidad + código).
- `AuthGate`: si la membresía activa es rol `patient` → `/portal`; staff → shell actual.
- Páginas y hooks con react-query (patrón del repo):
  - Inicio: próxima cita, consentimiento pendiente, resumen.
  - Solicitar cita: servicio → profesional → día → horario (`get_availability`) → INSERT.
  - Mis citas: lista + "Cancelar" habilitado solo dentro de las 24 h de creación.
  - Mi historial: `get_patient_history_summary()`.
  - Consentimiento: leer plantilla vigente + "Aceptar y firmar"; estado "Firmado el {fecha}".
  - Mi perfil: datos básicos de la ficha (lectura propia).

### Errores

- RPCs lanzan excepciones con mensajes accionables (código inválido/expirado, cita
  confirmada, ya firmado, solapamiento/tope) que el frontend muestra vía toaster.
- El frontend valida ventana de cancelación y disponibilidad antes de llamar al backend.

## Pruebas

`.test_patient_portal.mjs` (patrón del repo, `signIn`/`ok`/`expect`):
1. Registro: canje de código por ficha y por código general (crea ficha + N.° HCL).
2. Aislamiento RN07: paciente solo ve sus propios `patient`/`appointment`/`informed_consent`;
   staff conserva acceso a todo.
3. Solicitar cita: INSERT directo como paciente OK (snapshot precio/duración); solapamiento
   y tope rechazados; no puede crear cita para otro paciente.
4. Cancelar: dentro de 24 h OK; fuera de 24 h (creada con `created_at` pasado) rechazada.
5. Historial resumido: solo sesiones propias; sin contenido clínico en el resultado.
6. Consentimiento: `accept_consent` con plantilla vigente; segundo intento rechazado;
   cumple RN09.
7. Regresión: suites existentes (historial clínico, sesiones, caja, citas) siguen pasando
   tras restringir las policies member.

## Riesgos

- Romper acceso de staff al restringir policies member → cubierto por la regresión (punto 7).
- Códigos adivinables/robo → códigos aleatorios de alta entropía, expiración opcional,
  y el código por ficha solo vincula esa ficha.
- RPCs `security definer` → todas validan `auth.uid()` y pertenencia antes de escribir.
