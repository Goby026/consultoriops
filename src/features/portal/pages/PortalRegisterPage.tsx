import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, QrCode } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useRedeemCode } from '@/features/portal/hooks/usePortal'

const DOC_TYPES = ['DNI', 'PASAPORTE', 'CARNET_EXTRANJERIA', 'OTRO']

export function PortalRegisterPage() {
  const navigate = useNavigate()
  const redeemMutation = useRedeemCode()

  const [code, setCode] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [docType, setDocType] = useState(DOC_TYPES[0])
  const [docNumber, setDocNumber] = useState('')
  const [phone, setPhone] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    redeemMutation.mutate(
      {
        code: code.trim().toUpperCase(),
        identity: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthDate,
          gender: '',
          identity_doc_type: docType,
          identity_doc_number: docNumber.trim(),
          phone: phone.trim() || '',
        },
      },
      {
        onSuccess: () => {
          toast.success('¡Ficha vinculada! Ya puedes usar el portal.')
          navigate('/portal', { replace: true })
        },
        onError: (error: Error) => toast.error(error.message),
      },
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-1 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <QrCode className="size-5" />
          </div>
          <CardTitle className="text-xl">Vincula tu cuenta</CardTitle>
          <CardDescription>
            Ingresa el código que te entregó tu consultorio y tus datos de identificación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="portal-code">Código de vinculación</Label>
              <Input
                id="portal-code"
                placeholder="EJ: A1B2C3D4"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={20}
                required
                className="font-mono uppercase tracking-widest"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="portal-first">Nombres</Label>
                <Input
                  id="portal-first"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-last">Apellidos</Label>
                <Input
                  id="portal-last"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-birth">Fecha de nacimiento</Label>
              <Input
                id="portal-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Documento de identidad</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="portal-doc">Número</Label>
                <Input
                  id="portal-doc"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portal-phone">Teléfono (opcional)</Label>
              <Input
                id="portal-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            {redeemMutation.isError && (
              <p className="text-sm text-destructive">{redeemMutation.error.message}</p>
            )}
            <Button type="submit" className="w-full" disabled={redeemMutation.isPending}>
              {redeemMutation.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Vincular e ingresar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}