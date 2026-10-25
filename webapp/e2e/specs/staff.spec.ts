import type { Route } from '@playwright/test'

import { e2eAdminPassword, e2eUserEmail } from '../env'
import { expect, logIn, test } from '../helpers/test'

test('chef records staff events on mobile and desktop', async ({ browser }) => {
  for (const [index, viewport] of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ].entries()) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, e2eUserEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)

    let releaseStaffRequest!: () => void
    const staffRequestGate = new Promise<void>((resolve) => { releaseStaffRequest = resolve })
    const failStaffRequest = async (route: Route) => {
      await staffRequestGate
      await route.abort()
    }
    await page.route('**/api/staff?month=*', failStaffRequest)
    await page.goto('/app/staff')
    await expect(page.getByRole('status', { name: 'Загрузка сотрудников' })).toBeVisible()
    releaseStaffRequest()
    await expect(page.getByText('Не удалось загрузить сотрудников')).toBeVisible()
    await page.unroute('**/api/staff?month=*', failStaffRequest)

    const emptyStaffRequest = async (route: Route) => {
      const response = await route.fetch()
      const body = await response.json()
      await route.fulfill({
        response,
        json: {
          ...body,
          metrics: { activeEmployees: 0, latenessCount: 0, fineTotal: '0.00' },
          employees: [],
          events: [],
        },
      })
    }
    await page.route('**/api/staff?month=*', emptyStaffRequest)
    await page.getByRole('button', { name: 'Повторить' }).click()
    await expect(page.getByText('Добавьте первого сотрудника.')).toBeVisible()
    await expect(page.getByText('Добавьте сотрудника, чтобы фиксировать события.')).toBeVisible()
    await page.unroute('**/api/staff?month=*', emptyStaffRequest)
    await page.reload()

    await page.getByRole('button', { name: 'Добавить сотрудника' }).click()
    const employeeDialog = page.getByRole('dialog', { name: 'Новый сотрудник' })
    await employeeDialog.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(employeeDialog.getByText('Введите имя и должность не короче двух символов.')).toBeVisible()
    const employeeName = `Сотрудник E2E ${index + 1}`
    await employeeDialog.getByLabel('Имя').fill(employeeName)
    await employeeDialog.getByLabel('Должность').fill('Повар')
    await employeeDialog.getByRole('button', { name: 'Добавить', exact: true }).click()
    await expect(employeeDialog).toHaveCount(0)
    await expect(page.getByText(employeeName, { exact: true }).first()).toBeVisible()

    await page.getByRole('button', { name: 'Опоздание' }).click()
    const latenessDialog = page.getByRole('dialog', { name: 'Записать опоздание' })
    await latenessDialog.getByRole('button', { name: 'Сохранить' }).click()
    await expect(latenessDialog.getByText('Укажите дату, время прихода и причину.')).toBeVisible()
    await latenessDialog.getByLabel('Время прихода').fill('10:15')
    await latenessDialog.getByLabel('Причина').fill('Проверка опоздания')
    await latenessDialog.getByRole('button', { name: 'Сохранить' }).click()
    await expect(latenessDialog).toHaveCount(0)
    await expect(page.getByText('Проверка опоздания')).toBeVisible()

    await page.getByRole('button', { name: 'Штраф' }).click()
    const fineDialog = page.getByRole('dialog', { name: 'Добавить штраф' })
    await fineDialog.getByLabel('Сумма штрафа').fill('750')
    await fineDialog.getByLabel('Причина').fill('Проверка штрафа')
    await fineDialog.getByRole('button', { name: 'Сохранить' }).click()
    await expect(fineDialog).toHaveCount(0)
    await expect(page.getByText('Проверка штрафа')).toBeVisible()
    await expect(page.getByText(/^750\s*₽$/)).toBeVisible()

    await page.getByRole('button', { name: 'Предыдущий месяц' }).click()
    await expect(page.getByText('В этом месяце событий нет.')).toBeVisible()
    await page.getByRole('button', { name: 'Следующий месяц' }).click()
    await expect(page.getByText('Проверка опоздания')).toBeVisible()
    await expect(page.getByText('Проверка штрафа')).toBeVisible()

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await context.close()
  }
})
