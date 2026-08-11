const TENANT_TIMEZONE = 'America/Lima'

export function dayKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TENANT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

export function todayKey(): string {
  return dayKey(new Date().toISOString())
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TENANT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
