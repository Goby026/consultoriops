import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { THEME_STORAGE_KEY, isThemeName } from './theme'
import type { ThemeName } from './theme'
import { ThemeContext } from './themeContext'

function readInitialTheme(): ThemeName {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeName(saved)) return saved
  } catch {
    // localStorage no disponible
  }
  return 'default'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme)
    } catch {
      // persistencia opcional
    }
  }, [theme])

  const setTheme = useCallback((next: ThemeName) => setThemeState(next), [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
