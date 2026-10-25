import type { Route } from '@playwright/test'

import { e2eAdminPassword, e2eUserEmail } from '../env'
import { expect, logIn, test } from '../helpers/test'

test('chef manages settings and session on mobile and desktop', async ({ browser }) => {
  let loginEmail = e2eUserEmail

  for (const [index, viewport] of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ].entries()) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, loginEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)
    await page.goto('/app/settings')

    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Приложение на устройстве' })).toBeVisible()
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0)

    const theme = page.getByLabel('Тема')
    await theme.click()
    await page.getByRole('option', { name: 'Тёмная' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await theme.click()
    await page.getByRole('option', { name: 'Светлая' }).click()
    await expect(page.locator('html')).not.toHaveClass(/dark/)

    const email = page.getByLabel('Email для входа')
    const currentPassword = page.getByLabel('Текущий пароль')
    const newPassword = page.getByLabel('Новый пароль')
    const confirmation = page.getByLabel('Повторите пароль')
    const save = page.getByRole('button', { name: 'Сохранить данные входа' })

    await save.click()
    await expect(page.getByText('Измените email или укажите новый пароль')).toBeVisible()
    await currentPassword.fill(e2eAdminPassword)
    await newPassword.fill('new-password-123')
    await confirmation.fill('different-password')
    await save.click()
    await expect(page.getByText('Новый пароль и подтверждение не совпадают')).toBeVisible()

    const nextEmail = `settings-chef-${index + 1}@example.com`
    await email.fill(nextEmail)
    await currentPassword.fill('wrong-password')
    await newPassword.fill('')
    await confirmation.fill('')
    await save.click()
    await expect(page.getByText('Текущий пароль указан неверно.')).toBeVisible()

    let releaseCredentials!: () => void
    const credentialsGate = new Promise<void>((resolve) => { releaseCredentials = resolve })
    const holdCredentials = async (route: Route) => {
      await credentialsGate
      await route.continue()
    }
    await page.route('**/api/auth/credentials', holdCredentials)
    await currentPassword.fill(e2eAdminPassword)
    await save.click()
    await expect(page.getByRole('button', { name: 'Сохраняем…' })).toBeDisabled()
    releaseCredentials()
    await expect(page.getByText('Данные входа обновлены')).toBeVisible()
    await page.unroute('**/api/auth/credentials', holdCredentials)
    loginEmail = nextEmail

    await email.focus()
    await expect(email).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(currentPassword).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

    const failLogout = async (route: Route) => route.abort()
    await page.route('**/api/auth/logout', failLogout)
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page.getByText('Сессия всё ещё активна. Попробуйте ещё раз.')).toBeVisible()
    await page.unroute('**/api/auth/logout', failLogout)
    await page.getByRole('button', { name: 'Выйти' }).click()
    await expect(page).toHaveURL(/\/login(?:\?|$)/)

    await context.close()
  }
})
