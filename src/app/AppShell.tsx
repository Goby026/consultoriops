import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Banknote,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Globe,
  LogOut,
  Palette,
  Search,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
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
import { cn } from '@/lib/utils'

type NavItem = {
  to: string
  label: string
  icon: typeof Sparkles
  end?: boolean
}

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [{ to: '/app', label: 'Panel', icon: Sparkles, end: true }],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/app/pacientes', label: 'Pacientes', icon: Users },
      { to: '/app/citas', label: 'Citas', icon: CalendarDays },
      { to: '/app/sesiones', label: 'Sesiones', icon: ClipboardList },
      { to: '/app/caja', label: 'Caja', icon: Banknote },
    ],
  },
  {
    label: 'Administración',
    items: [{ to: '/app/configuracion', label: 'Configuración', icon: Settings }],
  },
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

function SidebarNavItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-primary before:transition-opacity',
          isActive
            ? 'bg-accent font-medium text-accent-foreground before:opacity-100'
            : 'text-muted-foreground before:opacity-0 hover:bg-accent/60 hover:text-foreground',
          collapsed && 'justify-center px-0 before:hidden',
        )
      }
    >
      <item.icon className="size-4 shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )
}

export function AppShell() {
  const { session } = useSession()
  const navigate = useNavigate()
  const profileQuery = useProfile(session?.user.id)
  const { theme, setTheme } = useTheme()
  const isPlatformAdmin = profileQuery.data?.is_platform_admin === true
  const profile = session?.user
  const [collapsed, setCollapsed] = useState(false)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  const groups = isPlatformAdmin
    ? [
        ...navGroups.slice(0, -1),
        {
          label: 'Administración',
          items: [
            { to: '/app/configuracion', label: 'Configuración', icon: Settings },
            { to: '/plataforma', label: 'Plataforma', icon: Globe },
          ],
        },
      ]
    : navGroups

  return (
    <div className="flex min-h-screen bg-muted/40">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r bg-background transition-[width] duration-200 md:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        <div className={cn('flex h-16 items-center gap-2.5 border-b', collapsed ? 'justify-center px-2' : 'px-4')}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-(--shadow-card)">
            <Sparkles className="size-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm leading-tight font-semibold">ConsultorioPS</p>
              <p className="text-[11px] leading-tight text-muted-foreground">Gestión clínica</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className={cn('ml-auto', collapsed && 'ml-0')}
            onClick={() => setCollapsed((c) => !c)}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          >
            {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          </Button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {!collapsed && <TenantSwitcher />}

          <nav className="space-y-1">
            {groups.map((group) => (
              <div key={group.label} className="space-y-1">
                {!collapsed && (
                  <p className="px-3 pt-4 pb-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => (
                  <SidebarNavItem key={item.to} item={item} collapsed={collapsed} />
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className={cn('border-t p-3', collapsed && 'flex justify-center px-0')}>
          <div className={cn('flex items-center gap-3 rounded-lg', collapsed && 'justify-center')}>
            <Avatar className="size-9 shrink-0">
              <AvatarFallback>{initials(profile?.user_metadata.full_name as string)}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {(profile?.user_metadata.full_name as string) || 'Usuario'}
                </p>
                <p className="truncate text-xs text-muted-foreground">{profile?.email}</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      <div className={cn('flex flex-1 flex-col transition-[padding] duration-200', collapsed ? 'md:pl-16' : 'md:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="md:hidden">
            <TenantSwitcher />
          </div>

          <div className="relative hidden w-72 md:block">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar…" className="pl-8" aria-label="Buscar" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" title="Notificaciones">
                  <Bell className="size-4" />
                  <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                  Sin notificaciones
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

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
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}