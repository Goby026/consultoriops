import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useSession } from '@/features/auth/hooks/useSession'
import { supabase } from '@/lib/supabaseClient'

export function CambiarContrasenaPage() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return null
  if (!session) return <Navigate to="/login" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setSubmitting(true)
    const { error: upErr } = await supabase.auth.updateUser({ password })
    if (upErr) {
      setSubmitting(false)
      setError(upErr.message)
      return
    }
    const { error: flagErr } = await supabase
      .from('user_profile')
      .update({ must_change_password: false })
      .eq('id', session.user.id)
    setSubmitting(false)
    if (flagErr) {
      toast.error('Contraseña cambiada, pero no se pudo limpiar el aviso. Intenta recargar.')
    } else {
      toast.success('Contraseña actualizada')
    }
    navigate('/app', { replace: true })
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklch, var(--accent) 60%, transparent), transparent 70%)',
        }}
      />
      <div className="relative flex w-full max-w-md flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-(--shadow-card)">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="text-lg leading-tight font-semibold">ConsultorioPS</p>
            <p className="text-sm text-muted-foreground">Cambiar contraseña</p>
          </div>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-xl">Cambiar contraseña</CardTitle>
            <CardDescription>
              Tu administrador reestableció tu acceso. Define una nueva contraseña para continuar.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nueva contraseña</Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirmar contraseña</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repite la contraseña"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Guardar contraseña
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}