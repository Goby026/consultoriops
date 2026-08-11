export const THEMES = ['default', 'amethyst', 'caffeine'] as const

export type ThemeName = (typeof THEMES)[number]

export const THEME_LABELS: Record<ThemeName, string> = {
  default: 'Claro (predeterminado)',
  amethyst: 'Amethyst Haze',
  caffeine: 'Caffeine',
}

export const THEME_STORAGE_KEY = 'consultoriops-theme'

export function isThemeName(value: string | null): value is ThemeName {
  return value != null && (THEMES as readonly string[]).includes(value)
}
