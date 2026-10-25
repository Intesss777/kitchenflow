import type { Route } from '@playwright/test'

import { e2eAdminPassword, e2eUserEmail } from '../env'
import { pngImage } from '../helpers/images'
import { expect, logIn, test } from '../helpers/test'

test('chef manages the profile on mobile and desktop', async ({ browser }) => {
  for (const [index, viewport] of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ].entries()) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, e2eUserEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)

    let releaseAvatarRequest!: () => void
    const avatarRequestGate = new Promise<void>((resolve) => { releaseAvatarRequest = resolve })
    const failAvatarRequest = async (route: Route) => {
      if (route.request().method() !== 'GET') return route.continue()
      await avatarRequestGate
      await route.abort()
    }
    await page.route('**/api/uploads/avatar', failAvatarRequest)
    await page.goto('/app/profile')
    await expect(page.getByRole('status', { name: 'Загрузка фото профиля' })).toBeVisible()
    releaseAvatarRequest()
    await expect(page.getByText('Не удалось загрузить фото профиля')).toBeVisible()
    await page.unroute('**/api/uploads/avatar', failAvatarRequest)
    await page.getByRole('button', { name: 'Повторить' }).click()
    await expect(page.getByTestId('avatar-preview')).toBeVisible()
    await expect(page.getByTestId('avatar-fallback')).toBeVisible()

    const displayName = page.getByTestId('profile-display-name')
    await displayName.fill('я')
    await expect(page.getByText('Имя должно содержать от 2 до 80 символов.')).toBeVisible()
    await expect(page.getByTestId('profile-save')).toBeDisabled()

    let releaseProfileRequest!: () => void
    const profileRequestGate = new Promise<void>((resolve) => { releaseProfileRequest = resolve })
    const holdProfileRequest = async (route: Route) => {
      await profileRequestGate
      await route.continue()
    }
    await page.route('**/api/users/me', holdProfileRequest)
    await displayName.fill(`Повар E2E ${index + 1}`)
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-save')).toHaveText('Сохраняем…')
    releaseProfileRequest()
    await expect(page.getByText('Профиль сохранён')).toBeVisible()
    await page.unroute('**/api/users/me', holdProfileRequest)

    await page.getByTestId('avatar-file-input').setInputFiles({
      name: 'avatar.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    })
    await expect(page.getByTestId('avatar-error')).toContainText(
      'Формат не поддерживается. Выберите изображение JPEG, PNG или HEIC.',
    )

    let releaseUpload!: () => void
    const uploadGate = new Promise<void>((resolve) => { releaseUpload = resolve })
    const holdUpload = async (route: Route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      await uploadGate
      await route.continue()
    }
    await page.route('**/storage/objects/**', holdUpload)
    await page.getByTestId('avatar-file-input').setInputFiles(pngImage)
    await expect(page.getByRole('button', { name: 'Загружаем…' })).toBeDisabled()
    releaseUpload()
    await expect(page.getByTestId('avatar-notice')).toContainText('Фото обновлено.')
    await page.unroute('**/storage/objects/**', holdUpload)

    await displayName.focus()
    await expect(displayName).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(page.getByLabel('Email')).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    await page.getByTestId('avatar-remove').click()
    await expect(page.getByTestId('avatar-fallback')).toBeVisible()
    await expect(page.getByTestId('avatar-remove')).toHaveCount(0)

    await context.close()
  }
})
