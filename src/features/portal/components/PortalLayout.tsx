import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ClipboardList,
  FileSignature,
  HeartPulse,
  Home,
  LogOut,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useSession } from '@/features/auth/hooks/useSession'
import { supabase } from '@/lib/supabaseClient'

const navigation = [
  { to: '/portal', label: 'Inicio', icon: Home, end: true },
  { to: '/portal/citas', label: 'Mis citas', icon: CalendarDays },
  { to: '/portal/nueva-cita', label: 'Solicitar cita', icon: CalendarDays },
  { to: '/portal/historial', label: 'Mi historial', icon: ClipboardList },
  { to: '/portal/consentimiento', label: 'Consentimiento', icon: FileSignature },
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

export function PortalLayout() {
  const { session } = useSession()
  const navigate = useNavigate()
  const profile = session?.user

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse className="size-4" />
            </div>
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-semibold">ConsultorioPS</p>
              <p className="text-[11px] text-muted-foreground">Portal del paciente</p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
                  }`
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="flex gap-1 md:hidden">
              {navigation.slice(0, 2).map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  <Button variant="ghost" size="icon">
                    <item.icon className="size-4" />
                  </Button>
                </NavLink>
              ))}
            </div>
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
                    <span className="font-medium">
                      {(profile?.user_metadata.full_name as string) || 'Usuario'}
                    </span>
                    <span className="text-xs text-muted-foreground">{profile?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/portal/perfil')}>
                  <User className="mr-2 size-4" />
                  Mi perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  <LogOut className="mr-2 size-4" />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  )
}