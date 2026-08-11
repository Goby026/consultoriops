import { formatTime, dayKey } from '@/features/citas/utils'

const TENANT_TIMEZONE = 'America/Lima'

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: TENANT_TIMEZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return `${formatDate(iso)} · ${formatTime(iso)}`
}

export function dateKey(iso: string): string {
  return dayKey(iso)
}
