import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
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
import { supabase } from '@/lib/supabaseClient'

export function LoginForm() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate(from, { replace: true })
  }

  const handleMagicLink = async () => {
    if (!email) {
      setError('Ingresa tu correo para enviar el enlace mágico')
      return
    }
    setError(null)
    setMagicLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email })
    setMagicLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    setMagicSent(true)
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">Iniciar sesión</CardTitle>
        <CardDescription>Accede a tu consultorio (RF01)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {magicSent ? (
          <p className="text-sm text-muted-foreground">
            Revisa tu bandeja de entrada: te enviamos un enlace mágico para iniciar sesión.
          </p>
        ) : (
          <>
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="usuario@consultorio.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Ingresando…' : 'Ingresar'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">o</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={magicLoading}
              onClick={handleMagicLink}
            >
              {magicLoading ? 'Enviando…' : 'Enviar enlace mágico'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              ¿Nuevo paciente?{' '}
              <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
                Crea una cuenta
              </Link>
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
