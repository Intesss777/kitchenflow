import type { UserDto } from '@kitchenflow/contracts'
import { useRef, useState, type ChangeEvent } from 'react'

import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { FieldDescription } from '@/components/ui/field'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/typography'
import { ApiRequestError } from '@/platform/api'
import {
  useAvatarImage,
  useAvatarQuery,
  useDeleteAvatarMutation,
  useUploadAvatarMutation,
} from './queries'
import { AvatarUploadError } from './upload'

const acceptedFileTypes = 'image/jpeg,image/png,image/heic,image/heif'

export function AvatarPanel({ user }: { user: UserDto }) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const avatarQuery = useAvatarQuery()
  const upload = useUploadAvatarMutation()
  const remove = useDeleteAvatarMutation()
  const imageUrl = useAvatarImage(avatarQuery.data?.avatar?.downloadUrl)

  const busy = upload.isPending || remove.isPending
  const hasAvatar = Boolean(avatarQuery.data?.avatar)

  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    // Clear the input so picking the same file twice still fires a change event, which is what
    // a retry after a failed upload looks like.
    event.target.value = ''
    if (!file) return

    setNotice(null)
    upload.mutate(file, {
      onSuccess: () => setNotice('Фото обновлено.'),
    })
  }

  return (
    <Card>
      <CardHeader>
        <Typography as="h2" variant="h6">
          Фото профиля
        </Typography>
        <CardDescription>
          Отображается рядом с вашим именем.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {avatarQuery.isPending ? (
          <div aria-label="Загрузка фото профиля" className="flex items-center gap-5" role="status">
            <Skeleton className="size-16 rounded-full" />
            <div className="grid gap-2">
              <Skeleton className="h-9 w-36" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ) : avatarQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Не удалось загрузить фото профиля</AlertTitle>
            <AlertDescription>Проверьте соединение и повторите попытку.</AlertDescription>
            <AlertAction>
              <Button onClick={() => void avatarQuery.refetch()} size="sm" variant="outline">
                Повторить
              </Button>
            </AlertAction>
          </Alert>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-5">
              <Avatar data-testid="avatar-preview" size="xl">
                {imageUrl && <AvatarImage alt="" src={imageUrl} />}
                <AvatarFallback data-testid="avatar-fallback">{initials(user)}</AvatarFallback>
              </Avatar>

              <div className="grid gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={busy}
                    onClick={() => fileInput.current?.click()}
                    type="button"
                    variant="outline"
                  >
                    {upload.isPending ? 'Загружаем…' : hasAvatar ? 'Заменить фото' : 'Добавить фото'}
                  </Button>
                  {hasAvatar && (
                    <Button
                      data-testid="avatar-remove"
                      disabled={busy}
                      onClick={() => {
                        setNotice(null)
                        remove.mutate(undefined, { onSuccess: () => setNotice('Фото удалено.') })
                      }}
                      type="button"
                      variant="ghost"
                    >
                      {remove.isPending ? 'Удаляем…' : 'Удалить'}
                    </Button>
                  )}
                </div>
                <FieldDescription>JPEG, PNG или HEIC, до 5 МБ.</FieldDescription>
              </div>

              {/*
                Kept out of the tab order: the button above is the control a keyboard or screen
                reader user operates, and leaving both focusable makes one action cost two tab stops.
              */}
              <input
                accept={acceptedFileTypes}
                aria-hidden="true"
                className="sr-only"
                data-testid="avatar-file-input"
                onChange={pick}
                ref={fileInput}
                tabIndex={-1}
                type="file"
              />
            </div>

            {upload.isError && (
              <Alert data-testid="avatar-error" variant="destructive">
                <AlertTitle>Фото не сохранено</AlertTitle>
                <AlertDescription>{uploadErrorMessage(upload.error)}</AlertDescription>
              </Alert>
            )}
            {remove.isError && (
              <Alert data-testid="avatar-remove-error" variant="destructive">
                <AlertTitle>Фото не удалено</AlertTitle>
                <AlertDescription>Проверьте соединение и повторите попытку.</AlertDescription>
              </Alert>
            )}
            {notice && !upload.isError && !remove.isError && (
              <Alert data-testid="avatar-notice">
                <AlertTitle>{notice}</AlertTitle>
              </Alert>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Each backend upload failure names something the person can do next, so they are surfaced
 * rather than collapsed into one generic message.
 */
function uploadErrorMessage(error: unknown) {
  if (error instanceof AvatarUploadError) return error.message

  if (error instanceof ApiRequestError) {
    if (error.code === 'UPLOAD_NOT_COMPLETED') {
      return 'Загрузка не завершилась. Попробуйте отправить фото ещё раз.'
    }
    if (error.code === 'UPLOAD_EXPIRED') {
      return 'Время загрузки истекло. Выберите фото ещё раз.'
    }
    if (error.code === 'UPLOAD_REJECTED') {
      return 'Формат не поддерживается. Выберите JPEG, PNG или HEIC.'
    }
  }

  return 'Не удалось загрузить фото. Проверьте соединение и повторите попытку.'
}

function initials(user: UserDto) {
  const source = user.displayName?.trim() || user.email

  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
