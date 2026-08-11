------------------------------------------------------------------------

# Documento de Requerimientos de Software (SRS)

**Sistema de Gestión para Consultorio Psicológico**

Versión 0.5.0 — Evolución a arquitectura SaaS multi-tenant con configuración independiente por consultorio

------------------------------------------------------------------------

# 1. Introducción

## 1.1 Propósito

Definir los requerimientos funcionales, no funcionales, reglas de negocio, modelo de datos y arquitectura técnica de una plataforma SaaS multi-tenant para la gestión de consultorios psicológicos. La plataforma permitirá que múltiples consultorios utilicen la misma aplicación, manteniendo sus datos y configuraciones aislados entre sí, mientras cada consultorio podrá administrar de forma independiente sus profesionales, usuarios, horarios, servicios, precios, planes, promociones, políticas y demás parámetros operativos. El sistema deberá cumplir criterios mínimos de buena práctica clínica (consentimiento informado, evaluación de riesgo, confidencialidad) y de protección de datos personales sensibles (datos de salud).

## 1.2 Alcance

El sistema permitirá:

- Gestión multi-tenant de múltiples consultorios dentro de una misma plataforma SaaS.
- Alta, configuración, suspensión y administración de consultorios.
- Aislamiento lógico de datos por consultorio mediante `tenant_id` y Row Level Security (RLS).
- Gestión de usuarios, roles y membresías por consultorio.
- Configuración independiente de cada consultorio: datos institucionales, profesionales, horarios, servicios, precios, planes, promociones, políticas y parámetros operativos.
- Gestión de pacientes, incluyendo pacientes menores de edad con representante legal.
- Administración de servicios y planes de pago propios de cada consultorio.
- Gestión de citas (agenda) respetando la configuración y disponibilidad del consultorio y de cada profesional.
- Registro de sesiones clínicas con anamnesis, notas de evolución (SOAP), diagnóstico, tratamiento y escalas de evaluación.
- Gestión de consentimiento informado y documentos asociados, con posibilidad de definir la versión vigente por consultorio.
- Detección y manejo de alertas de riesgo (ideación suicida, autolesión, violencia).
- Consulta de historial clínico con control de acceso estricto por rol y por consultorio.
- Portal para pacientes, limitado al consultorio al que pertenece su atención.
- Gestión de configuración y operación de la plataforma SaaS por un Administrador de Plataforma, sin acceso ordinario al contenido clínico de los consultorios.

## 1.3 Fuera de alcance (v0.4)

- Telemedicina / videollamada integrada (se deja como extensión futura).
- Facturación electrónica ante entidad tributaria.
- Integración con historia clínica electrónica de terceros (hospitales, seguros).
- Marketplace o directorio público de psicólogos.
- Facturación de suscripciones SaaS mediante un proveedor externo, salvo que se incorpore explícitamente en una versión posterior.

------------------------------------------------------------------------

# 2. Actores del Sistema

| Actor                        | Descripción                                                                                                                                                                                                                                                 |
|:-----------------------------|:------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Administrador de Plataforma  | Administra la plataforma SaaS y los consultorios/tenants, planes de suscripción, estado de cuentas, configuración global y soporte técnico. No debe acceder al contenido clínico salvo mediante un mecanismo excepcional, explícito, auditado y autorizado. |
| Administrador de Consultorio | Administra un consultorio específico, sus usuarios, profesionales, horarios, servicios, precios, promociones, políticas y configuración operativa. Solo tiene alcance sobre su consultorio.                                                                 |
| Profesional (Psicólogo)      | Atiende pacientes, registra anamnesis, evolución, diagnóstico y tratamiento; único rol que puede firmar notas clínicas. Su acceso está limitado a los consultorios a los que pertenece.                                                                     |
| Recepcionista                | Gestiona pacientes y citas dentro de su consultorio; **no** tiene acceso al contenido clínico de las sesiones.                                                                                                                                              |
| Paciente                     | Solicita citas, consulta su información y firma su consentimiento informado dentro del consultorio correspondiente.                                                                                                                                         |
| Representante legal (tutor)  | Actúa en nombre de un paciente menor de edad: agenda citas y ve historial resumido autorizado dentro del consultorio correspondiente.                                                                                                                       |

------------------------------------------------------------------------

# 3. Requerimientos Funcionales

## 3.1 Gestión SaaS y Multi-Tenant

- RF-SaaS01: El sistema debe permitir registrar y administrar múltiples consultorios independientes dentro de una misma instancia de la plataforma.
- RF-SaaS02: Cada consultorio debe constituir un tenant lógico identificado de forma única mediante `tenant_id`.
- RF-SaaS03: Todo registro de negocio perteneciente a un consultorio debe quedar asociado directa o indirectamente a un `tenant_id`.
- RF-SaaS04: El sistema debe impedir que usuarios de un consultorio consulten, modifiquen o eliminen información de otro consultorio.
- RF-SaaS05: Un usuario podrá pertenecer a uno o varios consultorios mediante una relación de membresía, conservando un rol y estado de acceso por consultorio.
- RF-SaaS06: El sistema debe permitir seleccionar el consultorio activo cuando un usuario tenga acceso a más de uno.
- RF-SaaS07: El sistema debe validar que todas las operaciones se ejecuten dentro del contexto del consultorio activo y autorizado.
- RF-SaaS08: El Administrador de Plataforma podrá activar, suspender, bloquear o dar de baja lógica un consultorio.
- RF-SaaS09: Un consultorio suspendido no debe permitir nuevas operaciones clínicas o administrativas, salvo las operaciones expresamente autorizadas para regularización o consulta.
- RF-SaaS10: El sistema debe registrar auditoría de cambios críticos sobre tenants, membresías, configuración y accesos.
- RF-SaaS11: La configuración global de la plataforma debe estar separada de la configuración específica de cada consultorio.
- RF-SaaS12: El sistema debe soportar evolución futura hacia planes SaaS, límites de uso, cuotas y funcionalidades por suscripción sin mezclar estos conceptos con la configuración clínica del consultorio.

## 3.2 Configuración del Consultorio

- RF-CON01: El Administrador de Consultorio debe poder configurar los datos institucionales del consultorio: nombre comercial, razón social, identificación tributaria, dirección, teléfonos, correo, logo, zona horaria y demás datos necesarios.
- RF-CON02: El Administrador de Consultorio debe poder configurar sus profesionales y asignarles servicios, horarios y reglas de disponibilidad.
- RF-CON03: El Administrador de Consultorio debe poder configurar los días laborables y horarios generales del consultorio.
- RF-CON04: El Administrador de Consultorio debe poder configurar horarios individuales por profesional, incluyendo múltiples bloques por día, descansos, vacaciones, feriados y excepciones.
- RF-CON05: El Administrador de Consultorio debe poder crear, editar, activar, desactivar y ordenar los servicios ofrecidos.
- RF-CON06: Cada servicio debe permitir configurar duración, precio, modalidad, profesional(es) habilitado(s), descripción y reglas de agenda.
- RF-CON07: El Administrador de Consultorio debe poder configurar precios por servicio de forma independiente.
- RF-CON08: El sistema debe permitir definir precios diferenciados según profesional, modalidad, duración o condición del servicio cuando el consultorio lo requiera.
- RF-CON09: El Administrador de Consultorio debe poder crear promociones con vigencia, condiciones, descuento o precio promocional, servicios afectados y límites de uso.
- RF-CON10: El sistema debe conservar el precio aplicado a una cita/pago como una fotografía histórica, de modo que modificar posteriormente el precio del servicio no altere operaciones anteriores.
- RF-CON11: El Administrador de Consultorio debe poder configurar métodos de pago aceptados y condiciones de pago.
- RF-CON12: El Administrador de Consultorio debe poder configurar planes de pago propios del consultorio.
- RF-CON13: El sistema debe permitir configurar plantillas y versiones de documentos institucionales, incluyendo el consentimiento informado.
- RF-CON14: El Administrador de Consultorio debe poder activar o desactivar funcionalidades disponibles para su operación, cuando estas sean compatibles con el plan SaaS contratado.
- RF-CON15: Los cambios de configuración críticos deben registrar usuario, fecha, valor anterior y valor nuevo cuando corresponda.

## 3.1 Seguridad y Acceso

- RF01: El sistema debe permitir iniciar sesión mediante Supabase Auth (email/password, con opción a magic link).
- RF02: El sistema debe emitir y validar sesiones usando el JWT nativo de Supabase Auth.
- RF03: El sistema debe permitir gestión de roles mediante una tabla `role` referenciada desde `user_profile`, reflejada en `auth.users` vía metadata o tabla espejo.
- RF03b: El sistema debe restringir el acceso a datos clínicos mediante Row Level Security (RLS) en PostgreSQL, no únicamente mediante lógica de frontend.
- RF03c: Las políticas RLS deben validar simultáneamente el usuario autenticado, su membresía en el consultorio y el alcance del rol correspondiente.
- RF03d: El contexto del tenant no debe depender únicamente de un valor enviado por el frontend; debe derivarse o validarse de la identidad/membresía autorizada del usuario.

## 3.3 Pacientes

- RF04: Registrar paciente, incluyendo indicador de minoría de edad y datos del representante legal si aplica.
- RF05: Actualizar datos del paciente.
- RF06: Consultar paciente.
- RF07: Consultar historial clínico completo (solo Profesional asignado y Administrador).
- RF07b: Consultar historial clínico resumido, sin contenido de notas SOAP ni anamnesis detallada (Paciente / Representante legal).

## 3.4 Consentimiento Informado

- RF08: Registrar la aceptación del consentimiento informado por parte del paciente (o representante legal), con fecha, versión del documento vigente y evidencia de firma.
- RF09: Bloquear el registro de la primera sesión clínica si no existe consentimiento informado vigente asociado al paciente.
- RF10: Almacenar el documento de consentimiento firmado en Supabase Storage, vinculado al registro de aceptación.

## 3.5 Servicios y Planes

- RF11: Crear servicios (tipos de terapia/consulta).
- RF12: Configurar máximo de citas por día por profesional.
- RF13: Gestionar planes de pago.

## 3.6 Citas

- RF14: Crear cita.
- RF15: Reprogramar cita.
- RF16: Cancelar cita.
- RF17: Consultar disponibilidad por profesional y fecha.
- RF18: Marcar asistencia de la cita (asistió / no asistió / tardanza).

## 3.7 Atención Clínica

- RF19: Registrar sesión clínica asociada a una cita ATENDIDA.
- RF20: Registrar anamnesis estructurada (motivo de consulta, antecedentes personales, antecedentes familiares, historia del problema actual, evaluación de factores de riesgo).
- RF21: Registrar nota de evolución en formato SOAP (Subjetivo, Objetivo, Análisis, Plan).
- RF22: Registrar diagnóstico con código estandarizado (CIE-11) y descripción libre.
- RF23: Registrar plan de tratamiento con objetivos terapéuticos medibles y frecuencia sugerida.
- RF24: Registrar resultados de escalas de evaluación estandarizadas (ej. PHQ-9, GAD-7) y visualizar su evolución temporal.
- RF25: Firmar digitalmente una nota clínica al finalizarla; una nota firmada pasa a ser inmutable.
- RF26: Permitir adenda a una nota ya firmada (no edición directa), preservando el registro original.
- RF27: Generar una alerta de riesgo cuando el profesional marque una sesión con nivel de riesgo “alto” (ideación suicida, autolesión activa, riesgo a terceros); la alerta debe ser visible solo para Administrador y para el propio profesional, nunca para Recepcionista ni Paciente.

## 3.8 Portal del Paciente

- RF28: Registrarse como paciente.
- RF29: Solicitar cita.
- RF30: Ver historial resumido (sin acceso a notas SOAP, anamnesis completa ni alertas de riesgo).
- RF31: Ver y firmar consentimiento informado pendiente.

------------------------------------------------------------------------

# 4. Reglas de Negocio

## RN00 — Aislamiento por consultorio

Ningún usuario podrá acceder a datos pertenecientes a un consultorio distinto de aquellos en los que tenga una membresía activa y autorizada.

## RN00b — Configuración independiente

Los profesionales, horarios, servicios, precios, promociones, planes de pago, documentos y demás parámetros operativos pertenecen al consultorio que los configura y no deben afectar a otros consultorios.

## RN00c — Membresía

El rol de un usuario debe determinarse dentro del contexto del consultorio. Un mismo usuario puede tener roles diferentes en distintos consultorios si la plataforma lo permite.

## RN00d — Historial de configuración

Los cambios de precio, promoción y configuración que afecten operaciones existentes no deben modificar retroactivamente los datos históricos de citas, sesiones o pagos.

## RN00e — Estado del consultorio

Si un consultorio está suspendido, el sistema debe bloquear las operaciones que puedan generar nueva actividad, conservando el acceso mínimo necesario para administración, soporte o recuperación según la política de la plataforma.

## RN01

Un paciente debe existir antes de agendar una cita.

## RN02

No se puede exceder el máximo de citas por día configurado por profesional.

## RN03

Una cita solo puede estar en los estados: \* PROGRAMADA \* CANCELADA \* ATENDIDA \* REPROGRAMADA \* NO_ASISTIO

## RN04

Solo citas en estado ATENDIDA pueden generar sesiones.

## RN05

Una sesión pertenece a una única cita.

## RN06

El profesional es el único rol que puede registrar y firmar sesiones, anamnesis, diagnóstico y tratamiento.

## RN07

El paciente (o su representante legal) solo puede ver su propia información, y únicamente en su forma resumida (RF30).

## RN08

No se puede reprogramar una cita cancelada.

## RN09

No se puede registrar la primera sesión de un paciente sin consentimiento informado vigente firmado (deriva de RF09).

## RN10

Una nota clínica firmada (RF25) es inmutable; cualquier corrección posterior debe registrarse como adenda con su propio autor y fecha, sin alterar el contenido original.

## RN11

Si el paciente es menor de edad, toda solicitud de cita y toda visualización de historial resumido debe realizarse a través del representante legal registrado, salvo excepción clínica documentada por el profesional.

## RN12

Las alertas de riesgo (RF27) no son visibles para el rol Recepcionista ni para el rol Paciente/Representante legal bajo ninguna circunstancia.

## RN13

Los datos clínicos (anamnesis, notas SOAP, diagnóstico, tratamiento, escalas, alertas de riesgo) se consideran datos sensibles de salud y su acceso, aun para Administrador, debe quedar registrado en una bitácora de auditoría.

------------------------------------------------------------------------

# 5. Modelo de Datos (Resumen)

## 5.1 Entidades principales

### Entidades de plataforma SaaS

- `tenant` — consultorio/organización que utiliza la plataforma.
- `tenant_subscription` — suscripción/plan SaaS, estado y vigencia del tenant.
- `tenant_settings` — configuración general específica del consultorio.
- `tenant_membership` — relación entre usuario y consultorio, incluyendo rol, estado y fechas de vigencia.

### Entidades de identidad

- `user_profile` (vinculada 1:1 a `auth.users` de Supabase)
- `role`
- `patient`
- `legal_guardian` (representante legal, para pacientes menores de edad)
- `informed_consent`
- `service`
- `service_price` — historial de precios o precios por condición cuando aplique.
- `promotion` — promociones propias del consultorio.
- `promotion_rule` — condiciones de aplicación de una promoción.
- `payment_method` — métodos de pago habilitados por consultorio.
- `payment_plan`
- `clinic_schedule` — horario general del consultorio.
- `professional_schedule` — horario del profesional.
- `schedule_exception` — vacaciones, feriados, bloqueos y excepciones.
- `document_template` — plantillas y versiones de documentos del consultorio.
- `appointment`
- `session`
- `anamnesis`
- `diagnosis`
- `treatment_plan`
- `progress_note` (nota SOAP)
- `assessment_scale` (definición de escala, ej. PHQ-9)
- `assessment_result` (resultado aplicado a un paciente en una fecha)
- `risk_alert`
- `audit_log`

## 5.2 Aislamiento multi-tenant

- Las entidades de negocio deben incluir `tenant_id` cuando sean directamente propiedad de un consultorio.
- Las relaciones entre entidades deben impedir referencias cruzadas entre tenants.
- Las claves foráneas y restricciones deben diseñarse para evitar que, por error de aplicación, un registro de un tenant se vincule con un registro de otro tenant.
- Las políticas RLS deben usar el `tenant_id` y la membresía del usuario como condición de acceso.
- `user_profile` es global a la plataforma; `tenant_membership` determina en qué consultorios puede operar el usuario.
- Un paciente puede ser tratado como registro independiente por consultorio en la primera versión. Si en el futuro se requiere identidad global del paciente entre consultorios, deberá modelarse mediante una entidad global separada y consentimiento explícito; no se debe compartir automáticamente información clínica entre tenants.

## 5.3 Notas sobre sensibilidad de datos

| Entidad                                                                   | Nivel de sensibilidad  | Comentario RLS                                                                 |
|:--------------------------------------------------------------------------|:-----------------------|:-------------------------------------------------------------------------------|
| `anamnesis`, `progress_note`, `diagnosis`, `treatment_plan`, `risk_alert` | Alta (dato de salud)   | Acceso exclusivo: profesional dueño de la sesión + administrador auditado      |
| `assessment_result`                                                       | Alta                   | Igual que anterior                                                             |
| `patient`, `legal_guardian`                                               | Media                  | Acceso: profesional, recepcionista (solo datos administrativos), administrador |
| `appointment`                                                             | Media-baja             | Acceso amplio a roles internos; paciente solo ve sus propias citas             |
| `informed_consent`                                                        | Alta (evidencia legal) | Inmutable una vez firmado; solo lectura tras creación                          |

------------------------------------------------------------------------

# 6. Arquitectura de Acceso a Datos (Supabase)

> Esta sección reemplaza la antigua especificación de API REST sobre Spring Boot. El frontend (SPA React) consume directamente el SDK de Supabase (`@supabase/supabase-js`) contra PostgreSQL, protegido por RLS, complementado con Edge Functions para lógica de negocio que no puede resolverse solo con políticas de fila.

## 6.1 Autenticación y contexto de tenant

- **Alta / login**: `supabase.auth.signUp` / `supabase.auth.signInWithPassword`, gestionado por Supabase Auth.
- **Sesión**: JWT de Supabase almacenado por el SDK; el frontend no gestiona JWT propio.
- **Identidad global**: `auth.users` identifica al usuario en la plataforma.
- **Membresía**: `tenant_membership` determina a qué consultorios pertenece el usuario, su rol y estado.
- **Tenant activo**: el frontend puede mantener el tenant seleccionado para navegación, pero la autorización real debe verificarse en RLS y/o Edge Functions.
- **Rol contextual**: el rol del usuario no debe considerarse global si puede variar por consultorio; la autorización debe evaluarse como combinación de `user_id + tenant_id + role`.
- **Administrador de Plataforma**: debe disponer de un alcance especial separado de los roles operativos del consultorio. Su acceso a datos clínicos no debe ser implícito.

## 6.2 Gestión de tenant y configuración

| Operación                    | Mecanismo       | Tabla(s)                                                         | RLS esperado                                                      | Edge Function                        |
|:-----------------------------|:----------------|:-----------------------------------------------------------------|:------------------------------------------------------------------|:-------------------------------------|
| Crear consultorio            | `insert`        | `tenant`, `tenant_settings`, `tenant_membership`                 | Solo Administrador de Plataforma / flujo de onboarding autorizado | Sí                                   |
| Configurar consultorio       | `insert/update` | `tenant_settings` y tablas de configuración                      | Solo Administrador de Consultorio del tenant                      | No / Sí si requiere reglas complejas |
| Gestionar membresías         | `insert/update` | `tenant_membership`                                              | Administrador del tenant / Plataforma según operación             | Sí                                   |
| Gestionar profesionales      | `insert/update` | `tenant_membership`, perfiles y configuración profesional        | Administrador del tenant                                          | No                                   |
| Configurar horarios          | `insert/update` | `clinic_schedule`, `professional_schedule`, `schedule_exception` | Administrador del tenant / profesional según permisos             | Sí — validación de solapamientos     |
| Configurar servicios/precios | `insert/update` | `service`, `service_price`                                       | Administrador del tenant                                          | No                                   |
| Gestionar promociones        | `insert/update` | `promotion`, `promotion_rule`                                    | Administrador del tenant                                          | Sí — validación de reglas            |
| Suspender tenant             | `update`        | `tenant`                                                         | Administrador de Plataforma                                       | Sí                                   |

## 6.3 Pacientes

| Operación           | Mecanismo                                   | Tabla(s)                                                               | RLS esperado                            | Edge Function                                               |
|:--------------------|:--------------------------------------------|:-----------------------------------------------------------------------|:----------------------------------------|:------------------------------------------------------------|
| Crear paciente      | `insert` vía SDK                            | `patient`, `legal_guardian` (si aplica)                                | Recepcionista/Profesional/Admin         | No                                                          |
| Actualizar paciente | `update` vía SDK                            | `patient`                                                              | Recepcionista/Profesional/Admin         | No                                                          |
| Consultar paciente  | `select` vía SDK                            | `patient`                                                              | Según rol (ver 5.2)                     | No                                                          |
| Historial completo  | `select` con joins                          | `session`, `anamnesis`, `diagnosis`, `treatment_plan`, `progress_note` | Solo profesional dueño + admin auditado | No                                                          |
| Historial resumido  | `select` restringido a columnas no clínicas | `appointment`, `assessment_result` (solo puntaje, no detalle clínico)  | Paciente/Representante (self)           | Sí — función que arma el resumen filtrando campos sensibles |

## 6.4 Consentimiento Informado

| Operación                                  | Mecanismo                                 | Tabla(s)                      | RLS esperado                                               | Edge Function                                                          |
|:-------------------------------------------|:------------------------------------------|:------------------------------|:-----------------------------------------------------------|:-----------------------------------------------------------------------|
| Registrar aceptación                       | `insert` + subida a Storage               | `informed_consent`            | Paciente/Representante (self) o Recepcionista en su nombre | Sí — valida versión vigente del documento antes de aceptar             |
| Bloquear primera sesión sin consentimiento | Validación previa a `insert` en `session` | `informed_consent`, `session` | —                                                          | Sí — Edge Function invocada antes de crear la sesión (implementa RN09) |

## 6.5 Citas

| Operación                | Mecanismo                          | Tabla(s)                 | RLS esperado                                   | Edge Function                             |
|:-------------------------|:-----------------------------------|:-------------------------|:-----------------------------------------------|:------------------------------------------|
| Consultar disponibilidad | `select` con función de agregación | `appointment`, `service` | Lectura amplia (interno) / filtrada (paciente) | Sí — calcula slots libres respetando RN02 |
| Crear cita               | `insert`                           | `appointment`            | Recepcionista/Profesional/Admin/Paciente(self) | Sí — valida RN01, RN02 antes de insertar  |
| Reprogramar cita         | `update`                           | `appointment`            | Igual que crear                                | Sí — valida RN08                          |
| Cancelar cita            | `update` (estado)                  | `appointment`            | Igual que crear                                | No                                        |

## 6.6 Atención Clínica

| Operación                | Mecanismo                                  | Tabla(s)                 | RLS esperado                                                  | Edge Function                                              |
|:-------------------------|:-------------------------------------------|:-------------------------|:--------------------------------------------------------------|:-----------------------------------------------------------|
| Registrar sesión         | `insert`                                   | `session`                | Solo Profesional, y solo si `appointment.status = ATENDIDA`   | Sí — valida RN04 y RN09                                    |
| Registrar anamnesis      | `insert`                                   | `anamnesis`              | Solo Profesional dueño de la sesión                           | No                                                         |
| Registrar nota SOAP      | `insert`                                   | `progress_note`          | Solo Profesional dueño de la sesión                           | No                                                         |
| Firmar nota              | `update` (campo `signed_at`, `signed_by`)  | `progress_note`          | Solo Profesional autor                                        | Sí — tras firmar, bloquea futuros `update` directos (RN10) |
| Adenda a nota firmada    | `insert` en tabla `progress_note_addendum` | `progress_note_addendum` | Solo Profesional                                              | No                                                         |
| Registrar diagnóstico    | `insert`                                   | `diagnosis`              | Solo Profesional                                              | No                                                         |
| Registrar tratamiento    | `insert`                                   | `treatment_plan`         | Solo Profesional                                              | No                                                         |
| Registrar escala         | `insert`                                   | `assessment_result`      | Solo Profesional                                              | No                                                         |
| Generar alerta de riesgo | `insert`                                   | `risk_alert`             | Solo Profesional (creación); lectura solo Profesional + Admin | Sí — dispara notificación interna (RF27, RN12)             |

## 6.7 Auditoría

- Toda lectura de tablas clasificadas como “Alta sensibilidad” (5.3) por parte de Administrador debe quedar registrada en `audit_log` (usuario, tenant, tabla, registro, timestamp). Implementado mediante trigger de PostgreSQL o Edge Function intermediaria, no confiar solo en logs de Supabase por defecto.
- Toda operación sobre datos de un tenant debe incorporar el contexto de tenant en la autorización.
- Las tablas que pertenecen a un tenant deben tener políticas RLS que impidan `select`, `insert`, `update` y `delete` fuera de la membresía autorizada.
- Se recomienda utilizar funciones SQL seguras para resolver el tenant y rol efectivos del usuario, evitando confiar en valores manipulables desde el cliente.
- Las Edge Functions deben validar nuevamente `tenant_id`, membresía y permisos para operaciones críticas.

------------------------------------------------------------------------

# 7. Flujos Principales (Frontend ↔ Supabase)

## Flujo 0: Alta y configuración de un consultorio

1.  Administrador de Plataforma inicia el proceso de alta del consultorio.
2.  Se crea `tenant` con identificador único y estado inicial.
3.  Se crea `tenant_settings` con valores por defecto.
4.  Se crea la membresía inicial del Administrador de Consultorio.
5.  El Administrador de Consultorio completa datos institucionales.
6.  Configura profesionales, servicios, precios, promociones, métodos de pago y horarios.
7.  El tenant queda habilitado para comenzar operaciones.

## Flujo 1: Login y selección de consultorio

1.  Frontend → `supabase.auth.signInWithPassword`.

2.  Supabase Auth valida credenciales y devuelve sesión con JWT.

3.  SDK persiste la sesión.

4.  Frontend consulta las membresías activas del usuario.

5.  Si existe un solo consultorio, se selecciona automáticamente.

6.  Si existen varios, el usuario selecciona el consultorio con el que desea trabajar.

7.  El frontend carga la configuración correspondiente al tenant seleccionado.

8.  RLS y Edge Functions validan que el usuario realmente tenga acceso al tenant antes de cualquier operación.

9.  Frontend → `supabase.auth.signInWithPassword`.

10. Supabase Auth valida credenciales y devuelve sesión con JWT.

11. SDK persiste la sesión (localStorage/cookie gestionado por el SDK).

12. Frontend consulta `user_profile` para obtener rol y personalizar la UI.

## Flujo 2: Registro de paciente

1.  Recepcionista completa formulario en el SPA dentro del consultorio activo.
2.  Frontend → `insert` en `patient` (y `legal_guardian` si es menor de edad) vía SDK, asociado al `tenant_id` autorizado.
3.  RLS valida que el usuario autenticado tiene rol autorizado.

## Flujo 3: Consentimiento informado

1.  Paciente (o representante) inicia sesión.
2.  Frontend detecta ausencia de consentimiento vigente y muestra el documento.
3.  Al aceptar, Frontend → Edge Function que registra `informed_consent` y sube evidencia a Storage.

## Flujo 4: Agendar cita

1.  Frontend consulta disponibilidad vía Edge Function (`GET`-equivalente a `/availability`).
2.  Usuario selecciona horario.
3.  Frontend → Edge Function de creación de cita, que valida RN01/RN02 y luego inserta en `appointment`.

## Flujo 5: Atención clínica

1.  Profesional abre una cita en estado ATENDIDA.
2.  Frontend → Edge Function que valida consentimiento (RN09) y crea la `session`.
3.  Profesional registra sucesivamente: anamnesis, nota SOAP, escalas de evaluación, diagnóstico y tratamiento (inserts directos vía SDK, protegidos por RLS).
4.  Si corresponde, Profesional marca nivel de riesgo alto → se crea `risk_alert`.
5.  Profesional firma la nota (`progress_note.signed_at`), quedando inmutable.

## Flujo 6: Historial clínico

- **Vista profesional/admin**: Frontend → `select` con joins sobre `session`, `anamnesis`, `diagnosis`, `treatment_plan`, `progress_note`, `assessment_result`. Acceso registrado en `audit_log`.
- **Vista paciente**: Frontend → Edge Function que arma un resumen (citas pasadas, puntajes de escalas, plan de tratamiento vigente en términos generales), excluyendo notas SOAP y anamnesis detallada.

## Flujo 7: Paciente solicita cita

1.  Paciente (o representante legal, si es menor de edad) inicia sesión.
2.  Consulta disponibilidad.
3.  Frontend → Edge Function de creación de cita (mismo flujo que Flujo 4, con `patientId` fijado al usuario autenticado).

------------------------------------------------------------------------

# 8. Requerimientos No Funcionales

## Seguridad

- Autenticación y emisión de JWT gestionadas por Supabase Auth.
- Autorización basada en RLS a nivel de fila en PostgreSQL, no solo en frontend.
- Contraseñas gestionadas y hasheadas por Supabase Auth (no se almacenan en tablas propias).
- Todo dato de salud (ver 5.2) accedido por Administrador debe quedar auditado (RN13).
- Cifrado en tránsito (TLS) y en reposo, provisto de forma nativa por Supabase.
- Documentos sensibles (consentimientos, informes) almacenados en buckets privados de Supabase Storage con URLs firmadas de vida corta.
- El acceso a Storage debe estar igualmente aislado por tenant; las rutas y políticas no deben permitir enumerar ni descargar documentos de otros consultorios.
- Ningún identificador de tenant recibido desde el cliente debe considerarse evidencia suficiente de autorización.
- Los eventos de cambio de tenant, suspensión, membresías y permisos deben quedar auditados.
- El Administrador de Plataforma debe operar bajo privilegio mínimo y no heredar automáticamente permisos clínicos de los Administradores de Consultorio.

## Cumplimiento normativo

- Tratamiento de datos personales de salud conforme a la Ley N.° 29733 (Ley de Protección de Datos Personales, Perú) y su reglamento: consentimiento expreso para datos sensibles, finalidad definida, y derecho de acceso/rectificación/cancelación del paciente.
- Política de retención de historia clínica alineada a la normativa sectorial vigente aplicable a servicios de salud mental en Perú (a validar con asesoría legal antes de producción).

## Rendimiento

- Tiempo de respuesta objetivo \< 3 segundos para operaciones interactivas (consulta de disponibilidad, carga de historial resumido).

## Disponibilidad

- 99% uptime, dependiente del SLA de Supabase y Vercel.

## Escalabilidad

- Arquitectura desacoplada: SPA estático servido por CDN de Vercel; toda lógica de datos y negocio delegada a Supabase (Postgres + Edge Functions), permitiendo escalar frontend y backend de forma independiente.
- La arquitectura debe soportar múltiples tenants sin crear una aplicación ni una base de datos independiente por consultorio en la primera etapa.
- El aislamiento lógico por `tenant_id` y RLS debe ser obligatorio para todos los datos de negocio.
- Debe existir capacidad futura de migrar tenants de alto volumen a infraestructura o bases de datos dedicadas sin rediseñar el dominio funcional.

## Trazabilidad y Backups

- Backups automáticos de PostgreSQL gestionados por Supabase, con política de retención definida antes de producción.
- `audit_log` como fuente de trazabilidad de accesos a datos sensibles.

------------------------------------------------------------------------

# 9. Consideraciones Técnicas

## 9.1 Frontend

- React (latest) + Vite (latest) + TypeScript.

- Tailwind CSS (latest) con componentes Shadcn/ui para estilos.

- Gestión de estado de datos remotos: TanStack Query, sincronizado con el SDK de Supabase, para cacheo y revalidación de consultas.

- Tipado de la base de datos generado automáticamente con `supabase gen types typescript`, evitando desincronización entre el esquema real y los tipos usados en el frontend.

- Estructura de carpetas sugerida:

      src/
        app/            # configuración de rutas y providers
        features/       # pacientes, citas, sesiones, consentimiento (por dominio)
        shared/         # componentes UI, hooks y utilidades comunes
        lib/
          supabaseClient.ts
          database.types.ts   # generado por supabase gen types

## 9.2 Backend (Supabase)

- PostgreSQL como base de datos, con políticas RLS explícitas por tabla (ver sección 6).
- Modelo multi-tenant basado en `tenant` + `tenant_membership` + `tenant_id` en entidades de negocio.
- Supabase Auth para autenticación (email/password, magic link opcional).
- Supabase Storage para consentimientos y documentos adjuntos, en buckets privados.
- Edge Functions (Deno) para lógica de negocio que excede lo que RLS puede validar por sí solo: disponibilidad de citas, validación de consentimiento previo a sesión, armado de historial resumido para pacientes, registro de auditoría.

## 9.3 Despliegue

- Repositorio en GitHub.
- Vercel conectado al repositorio, con despliegue automático en cada push/merge a `main`.
- Variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) gestionadas como Environment Variables de Vercel, nunca hardcodeadas.
- Ambientes recomendados: `preview` (por cada Pull Request, vía Vercel Preview Deployments) y `production` (rama `main`), idealmente contra proyectos Supabase separados (staging/producción) para evitar mezclar datos clínicos reales con pruebas.

------------------------------------------------------------------------

# 10. Mejores Prácticas Incluidas

- Tipado estricto extremo a extremo (TypeScript + tipos generados desde el esquema de Supabase).
- Autorización aplicada en la capa de datos (RLS), no solo validada en el cliente.
- Aislamiento multi-tenant obligatorio mediante `tenant_id`, membresías y políticas RLS.
- Separación entre alcance de plataforma y alcance de consultorio.
- Separación clara entre datos administrativos y datos clínicos sensibles a nivel de modelo y de políticas de acceso.
- Configuración por tenant para profesionales, horarios, servicios, precios, promociones y documentos.
- Inmutabilidad de notas clínicas firmadas, con mecanismo de adenda en vez de edición destructiva.
- Manejo explícito de menores de edad y representantes legales.
- Protocolo de alerta de riesgo clínico separado del flujo administrativo ordinario.
- Auditoría de accesos a datos de salud.
- Despliegue continuo con ambientes de previsualización aislados de producción.

------------------------------------------------------------------------

# 11. Registro de Cambios Frente a la Versión V0.4.0

## Agregado

- Arquitectura SaaS multi-tenant para soportar múltiples consultorios en una misma plataforma.
- Entidad `tenant` y contexto de consultorio para aislar datos.
- `tenant_membership` para permitir que un usuario pertenezca a uno o varios consultorios.
- Roles diferenciados entre Administrador de Plataforma y Administrador de Consultorio.
- Configuración independiente por consultorio de profesionales, horarios, servicios, precios, promociones, métodos de pago y documentos.
- Reglas de aislamiento y RLS por tenant.
- Suspensión y ciclo de vida básico del consultorio.
- Historial de precios/promociones para evitar modificaciones retroactivas.
- Rol de Representante legal y manejo de pacientes menores de edad (RF04, RN11).
- Módulo de Consentimiento Informado completo, con bloqueo de primera sesión si no está vigente (RF08–RF10, RN09).
- Anamnesis estructurada con evaluación explícita de factores de riesgo (RF20).
- Notas de evolución en formato SOAP en lugar de campo libre de “observaciones” (RF21).
- Escalas de evaluación estandarizadas y su seguimiento temporal (RF24).
- Firma digital de notas clínicas, inmutabilidad y mecanismo de adenda (RF25, RF26, RN10).
- Sistema de alertas de riesgo con visibilidad restringida (RF27, RN12).
- Historial clínico diferenciado: completo (interno) vs. resumido (paciente) (RF07, RF07b, RF30).
- Bitácora de auditoría para accesos administrativos a datos de salud (RN13).
- Diagnóstico con código estandarizado (CIE-11) además de descripción libre (RF22).
- Referencia explícita a normativa peruana de protección de datos personales (sección 8).

## Eliminado / Reemplazado

- Toda la especificación de API REST sobre Spring Boot (sección 6 original) fue reemplazada por el modelo de acceso directo vía SDK de Supabase + Edge Functions (nueva sección 6).
- Autenticación JWT custom reemplazada por Supabase Auth.
- Persistencia en MySQL reemplazada por PostgreSQL gestionado por Supabase.
- Arquitectura en capas Controller/Service/Repository (Spring) reemplazada por arquitectura desacoplada SPA + BaaS.

## Por definir antes de producción

- Validación legal formal de la política de retención de historia clínica en Perú.
- Definición de la vigencia y versión del documento de consentimiento informado.
- Decisión final sobre uso de ambientes Supabase separados para staging y producción.

------------------------------------------------------------------------

------------------------------------------------------------------------

# 12. Requerimientos SaaS pendientes de definición antes de producción

- Definir los planes comerciales de la plataforma SaaS (por ejemplo: Básico, Profesional, Empresa).
- Definir límites por plan: número de profesionales, pacientes, citas mensuales, almacenamiento, promociones, sucursales y funcionalidades.
- Definir si un mismo consultorio podrá tener múltiples sedes y, de ser así, modelar `branch`/`location` como nivel adicional debajo de `tenant`.
- Definir política de exportación y portabilidad de datos cuando un consultorio cancele su suscripción.
- Definir período de gracia y comportamiento del tenant después del vencimiento de la suscripción.
- Definir si el Administrador de Plataforma tendrá soporte técnico con acceso excepcional a datos clínicos; se recomienda que, por defecto, no tenga acceso al contenido clínico.
- Definir política de eliminación lógica, retención y eventual eliminación definitiva de datos de un tenant.
- Definir estrategia de backups y recuperación por tenant.
- Definir métricas de uso y límites de consumo sin registrar innecesariamente datos clínicos.
- Definir dominio/subdominio por consultorio si se desea personalización futura.
- Validar legalmente el tratamiento de datos personales entre la plataforma SaaS y cada consultorio como responsable/encargado, incluyendo contratos, finalidades, encargos de tratamiento y ubicación de los datos.
- Definir estrategia de aislamiento para Supabase Storage, incluyendo convenciones de rutas por `tenant_id`.
- Definir pruebas automatizadas de seguridad que verifiquen que un usuario de Tenant A nunca pueda consultar información de Tenant B.

## 12.1 Decisión arquitectónica recomendada

La primera versión SaaS debe utilizar un modelo **shared database / shared schema con aislamiento lógico por `tenant_id` y RLS**, siempre que el volumen inicial lo permita. Cada consultorio se modela como un tenant independiente y todas las entidades de negocio quedan vinculadas a dicho tenant.

No se recomienda crear una base de datos o proyecto Supabase por consultorio en la primera etapa porque aumentaría significativamente el costo operativo, la complejidad de despliegue, migraciones, monitoreo y mantenimiento. La arquitectura debe, sin embargo, evitar dependencias que impidan migrar posteriormente un tenant de alto volumen a infraestructura dedicada.

## 12.2 Principio fundamental de seguridad

**El `tenant_id` no es solamente un filtro de interfaz; es una frontera de seguridad.**

El frontend puede mostrar únicamente información del consultorio activo, pero la garantía real de aislamiento debe implementarse en PostgreSQL mediante RLS, funciones de autorización y restricciones de integridad. Una consulta manipulada desde el navegador nunca debe permitir cambiar de tenant ni acceder a información de otro consultorio.

## 12.3 Alcance de configuración por consultorio

Como regla general, los siguientes elementos deben ser configurables independientemente por cada tenant:

| Configuración                       | Alcance                                |
|:------------------------------------|:---------------------------------------|
| Datos institucionales               | Por consultorio                        |
| Logo y branding                     | Por consultorio                        |
| Profesionales                       | Por consultorio                        |
| Roles/membresías                    | Por consultorio                        |
| Horarios generales                  | Por consultorio                        |
| Horarios profesionales              | Por profesional dentro del consultorio |
| Servicios                           | Por consultorio                        |
| Duración de servicios               | Por servicio/consultorio               |
| Precios                             | Por consultorio                        |
| Promociones                         | Por consultorio                        |
| Planes de pago                      | Por consultorio                        |
| Métodos de pago                     | Por consultorio                        |
| Documentos/consentimientos          | Por consultorio                        |
| Reglas de agenda                    | Por consultorio/profesional            |
| Parámetros operativos               | Por consultorio                        |
| Configuración de la plataforma SaaS | Global / Administrador de Plataforma   |
| Plan y límites SaaS                 | Por tenant, definidos desde plataforma |
