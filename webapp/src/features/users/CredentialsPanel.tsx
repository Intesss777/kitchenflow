import { updateCredentialsRequestSchema, type UserDto } from '@kitchenflow/contracts'
import { useState, type FormEvent } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { credentialsErrorMessage } from './credentials-error'
import { useUpdateCredentialsMutation } from './queries'

export function CredentialsPanel({ user }: { user: UserDto }) {
  const mutation = useUpdateCredentialsMutation()
  const [email, setEmail] = useState(user.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedEmail = email.trim().toLowerCase()
    if (newPassword && newPassword !== confirmation) {
      setValidationError('Новый пароль и подтверждение не совпадают')
      return
    }
    const parsed = updateCredentialsRequestSchema.safeParse({
      currentPassword,
      email: normalizedEmail === user.email ? undefined : normalizedEmail,
      newPassword: newPassword || null,
    })
    if (!parsed.success) {
      setValidationError(
        normalizedEmail === user.email && !newPassword
          ? 'Измените email или укажите новый пароль'
          : 'Проверьте email и пароли. Пароль должен содержать не менее 8 символов',
      )
      return
    }
    setValidationError(null)
    mutation.mutate(parsed.data, {
      onSuccess: (response) => {
        setEmail(response.user.email)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmation('')
      },
    })
  }

  const resetResult = () => {
    setValidationError(null)
    mutation.reset()
  }

  return (
    <Card>
      <CardHeader>
        <Typography as="h2" variant="h6">Логин и пароль</Typography>
        <CardDescription>
          Email используется как логин. Изменения подтверждаются текущим паролем.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" noValidate onSubmit={submit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="credentials-email">Email для входа</FieldLabel>
              <Input
                autoComplete="email"
                disabled={mutation.isPending}
                id="credentials-email"
                onChange={(event) => { setEmail(event.target.value); resetResult() }}
                type="email"
                value={email}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="credentials-current-password">Текущий пароль</FieldLabel>
              <Input
                autoComplete="current-password"
                disabled={mutation.isPending}
                id="credentials-current-password"
                onChange={(event) => { setCurrentPassword(event.target.value); resetResult() }}
                required
                type="password"
                value={currentPassword}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="credentials-new-password">Новый пароль</FieldLabel>
                <Input
                  autoComplete="new-password"
                  disabled={mutation.isPending}
                  id="credentials-new-password"
                  onChange={(event) => { setNewPassword(event.target.value); resetResult() }}
                  placeholder="Оставьте пустым, если не меняете"
                  type="password"
                  value={newPassword}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="credentials-confirmation">Повторите пароль</FieldLabel>
                <Input
                  autoComplete="new-password"
                  disabled={mutation.isPending}
                  id="credentials-confirmation"
                  onChange={(event) => { setConfirmation(event.target.value); resetResult() }}
                  type="password"
                  value={confirmation}
                />
              </Field>
            </div>
            <FieldDescription>
              После сохранения все другие активные сеансы этого аккаунта будут завершены.
            </FieldDescription>
          </FieldGroup>

          {(validationError || mutation.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Данные входа не изменены</AlertTitle>
              <AlertDescription>
                {validationError ?? credentialsErrorMessage(mutation.error)}
              </AlertDescription>
            </Alert>
          )}
          {mutation.isSuccess && (
            <Alert>
              <AlertTitle>Данные входа обновлены</AlertTitle>
              <AlertDescription>При следующем входе используйте новый email или пароль.</AlertDescription>
            </Alert>
          )}
          <div>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Сохраняем…' : 'Сохранить данные входа'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
