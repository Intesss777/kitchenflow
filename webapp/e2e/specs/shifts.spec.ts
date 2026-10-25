import type { Route } from '@playwright/test'

import { e2eAdminPassword, e2eUserEmail } from '../env'
import { pngImage } from '../helpers/images'
import { expect, logIn, test } from '../helpers/test'

test('chef reviews and closes a shift on mobile and desktop', async ({ browser }) => {
  for (const [index, viewport] of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ].entries()) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, e2eUserEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)

    let releaseShiftsRequest!: () => void
    const shiftsRequestGate = new Promise<void>((resolve) => { releaseShiftsRequest = resolve })
    const failShiftsRequest = async (route: Route) => {
      await shiftsRequestGate
      await route.abort()
    }
    await page.route('**/api/shifts', failShiftsRequest)
    await page.goto('/app/shifts')
    await expect(page.getByRole('status', { name: 'Загрузка смен' })).toBeVisible()
    releaseShiftsRequest()
    await expect(page.getByText('Не удалось загрузить смены')).toBeVisible()
    await page.unroute('**/api/shifts', failShiftsRequest)

    const emptyShiftsRequest = async (route: Route) => {
      const response = await route.fetch()
      const body = await response.json()
      await route.fulfill({
        response,
        json: {
          ...body,
          metrics: { receiptsToday: 0, dishesToday: 0, needsReview: 0, confirmedThisMonth: 0 },
          shifts: [],
        },
      })
    }
    await page.route('**/api/shifts', emptyShiftsRequest)
    await page.getByRole('button', { name: 'Повторить' }).click()
    await expect(page.getByRole('heading', { name: 'Смена ещё не открыта' })).toBeVisible()
    await page.unroute('**/api/shifts', emptyShiftsRequest)
    await page.reload()

    const shiftDateInput = page.getByLabel('Дата смены')
    const businessDate = await shiftDateInput.inputValue()
    const shiftDate = new Date(`${businessDate}T00:00:00.000Z`)
    shiftDate.setUTCDate(shiftDate.getUTCDate() - index - 1)
    await shiftDateInput.fill(shiftDate.toISOString().slice(0, 10))
    await page.getByLabel('Фотографии чеков').setInputFiles(pngImage)

    await expect(page.getByRole('heading', { name: 'Фотографии чеков' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'Чек 1' })).toBeVisible()
    await expect(page.getByText('Расход продуктов', { exact: true })).toBeVisible()

    const removeButtons = page.getByRole('button', { name: 'Удалить позицию' })
    while (await removeButtons.count() > 1) {
      const count = await removeButtons.count()
      await removeButtons.last().click()
      await expect(removeButtons).toHaveCount(count - 1)
    }
    const quantity = page.getByLabel('Количество').first()
    await quantity.fill('0')
    await page.getByRole('button', { name: 'Сохранить проверку' }).click()
    await expect(page.getByText('Выберите блюдо и укажите целое количество больше нуля. Одинаковые блюда объедините в одну строку.')).toBeVisible()
    await quantity.fill('1')

    const updateResponse = page.waitForResponse((response) =>
      response.request().method() === 'PATCH' && /\/api\/shifts\/[0-9a-f-]+$/.test(response.url()),
    )
    await page.getByRole('button', { name: 'Сохранить проверку' }).click()
    expect((await updateResponse).ok()).toBe(true)

    const confirmResponse = page.waitForResponse((response) =>
      response.request().method() === 'POST' && /\/api\/shifts\/[0-9a-f-]+\/confirm$/.test(response.url()),
    )
    await page.getByRole('button', { name: 'Подтвердить и списать' }).click()
    expect((await confirmResponse).ok()).toBe(true)
    await expect(page.getByText('Смена закрыта', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Подтвердить и списать' })).toHaveCount(0)

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await context.close()
  }
})
