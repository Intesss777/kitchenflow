import { Download04Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMemo, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Typography } from '@/components/typography'
import {
  isAppleMobilePlatform,
  resolvePwaInstallationState,
} from '@/platform/pwa/model'
import {
  getPwaInstallationSnapshot,
  requestPwaInstallation,
  subscribeToPwaInstallation,
} from '@/platform/pwa/install-prompt'

export function InstallAppPanel() {
  const { installPrompt, isStandalone } = useSyncExternalStore(
    subscribeToPwaInstallation,
    getPwaInstallationSnapshot,
  )
  const isAppleMobile = useMemo(() => readAppleMobile(), [])

  const state = resolvePwaInstallationState({
    hasInstallPrompt: installPrompt !== null,
    isAppleMobile,
    isStandalone,
  })

  return (
    <Card>
      <CardHeader>
        <Typography as="h2" variant="h6">
          Приложение на устройстве
        </Typography>
        <CardDescription>
          Открывайте KitchenFlow с главного экрана без адресной строки браузера.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <InstallationMessage state={state} />
        {state === 'prompt' && (
          <Button onClick={() => void requestPwaInstallation()} type="button">
            <HugeiconsIcon aria-hidden icon={Download04Icon} strokeWidth={2} />
            Установить KitchenFlow
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function InstallationMessage({
  state,
}: {
  state: ReturnType<typeof resolvePwaInstallationState>
}) {
  if (state === 'installed') {
    return (
      <Typography tone="muted" variant="bodySm">
        KitchenFlow уже установлен на этом устройстве.
      </Typography>
    )
  }
  if (state === 'apple-instructions') {
    return (
      <Typography tone="muted" variant="bodySm">
        В Safari нажмите «Поделиться», затем «На экран Домой» и включите «Открывать как веб-приложение».
      </Typography>
    )
  }
  if (state === 'browser-menu') {
    return (
      <Typography tone="muted" variant="bodySm">
        Откройте меню браузера и выберите «Установить приложение» или «Добавить на главный экран».
      </Typography>
    )
  }
  return (
    <Typography tone="muted" variant="bodySm">
      Иконка появится на рабочем или главном экране этого устройства.
    </Typography>
  )
}

function readAppleMobile() {
  return isAppleMobilePlatform({
    maxTouchPoints: navigator.maxTouchPoints,
    platform: navigator.platform,
    userAgent: navigator.userAgent,
  })
}
