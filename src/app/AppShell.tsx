import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  ClipboardList,
  Globe,
  LogOut,
  Palette,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TenantSwitcher } from '@/features/tenants/components/TenantSwitcher'
import { useSession } from '@/features/auth/hooks/useSession'
import { useProfile } from '@/features/auth/hooks/useProfile'
import { useTheme } from '@/features/theme/useTheme'
import { THEMES, THEME_LABELS } from '@/features/theme/theme'
import { supabase } from '@/lib/supabaseClient'

const navigation = [
  { to: '/', label: 'Panel', icon: Sparkles, end: true },
  { to: '/pacientes', label: 'Pacientes', icon: Users },
  { to: '/citas', label: 'Citas', icon: CalendarDays },
  { to: '/sesiones', label: 'Sesiones', icon: ClipboardList },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

function initials(name: string | null | undefined) {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function AppShell() {
  const { session } = useSession()
  const navigate = useNavigate()
  const profileQuery = useProfile(session?.user.id)
  const { theme, setTheme } = useTheme()
  const isPlatformAdmin = profileQuery.data?.is_platform_admin === true
  const profile = session?.user

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-muted/40 md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Sparkles className="size-5 text-primary" />
          <span className="font-semibold">ConsultorioPS</span>
        </div>

        <div className="space-y-4 p-4">
          <TenantSwitcher />

          <nav className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
            {isPlatformAdmin && (
              <NavLink
                to="/plataforma"
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                  }`
                }
              >
                <Globe className="size-4" />
                Plataforma
              </NavLink>
            )}
          </nav>
        </div>
      </aside>

      <div className="flex flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="md:hidden">
            <TenantSwitcher />
          </div>
          <div className="hidden md:block" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <Avatar className="size-8">
                  <AvatarFallback>{initials(profile?.user_metadata.full_name as string)}</AvatarFallback>
                </Avatar>
                <span className="hidden text-sm font-medium sm:block">
                  {(profile?.user_metadata.full_name as string) || profile?.email}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{(profile?.user_metadata.full_name as string) || 'Usuario'}</span>
                  <span className="text-xs text-muted-foreground">{profile?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette className="mr-2 size-4" />
                  Tema de colores
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>Apariencia</DropdownMenuLabel>
                  {THEMES.map((t) => (
                    <DropdownMenuItem key={t} onSelect={() => setTheme(t)}>
                      <Check
                        className="mr-2 size-4"
                        style={{ opacity: theme === t ? 1 : 0 }}
                      />
                      {THEME_LABELS[t]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleSignOut}>
                <LogOut className="mr-2 size-4" />
                Cerrar sesión
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
