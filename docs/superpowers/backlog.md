# Backlog / Issues conocidos

## Seguridad — Auto-promoción a `is_platform_admin` (resuelto 2026-08-19)

- **Fecha detectado**: 2026-08-17
- **Severidad**: alta (escalada de privilegios)
- **Fix aplicado**: migración `20260825000200_user_profile_platform_admin_guard.sql` — trigger `BEFORE INSERT OR UPDATE` en `public.user_profile` que bloquea cambios de `is_platform_admin` salvo que el invocador sea platform admin (`is_platform_admin()`) o el contexto sea de servidor (`auth.uid() is null`: service role / CLI postgres).
- **Verificado**: `.test_user_profile_guard.mjs` (fases normal + promovida) — bloquea UPDATE/INSERT de auto-promoción para professional y tenant_admin, sin falso positivo en updates normales, platform admin SÍ puede cambiar su flag, promote/demote por CLI sigue funcionando. Regresiones completas: platform_admin, admin_users (incluye self-clear de `must_change_password`), caja_cobros, payment_config, attendance_capacity, signature_addendum_risk, historial_clinico.
