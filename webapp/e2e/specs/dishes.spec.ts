import type { Route } from '@playwright/test'

import { e2eAdminEmail, e2eAdminPassword, e2eUserEmail } from '../env'
import { pngImage } from '../helpers/images'
import { expect, logIn, test } from '../helpers/test'

test('prepares all dish cards for printing or saving as PDF', async ({ page }) => {
  await page.goto('/login')
  await logIn(page, e2eAdminEmail, e2eAdminPassword)
  await page.getByTestId('nav-link-admin-dishes').click()
  await expect(page).toHaveURL(/\/admin\/dishes$/)

  await page.evaluate(() => {
    Object.defineProperty(window, 'print', {
      configurable: true,
      value: () => { document.body.dataset.printInvoked = 'true' },
    })
  })
  await page.getByRole('button', { name: 'Печать / PDF' }).click()

  await expect(page.locator('body')).toHaveAttribute('data-print-invoked', 'true')
  await expect(page.locator('body')).toHaveClass(/dish-printing/)
  const sheet = page.locator('[data-dish-print-sheet]')
  await expect(sheet.locator('h1')).toHaveText('Карты блюд')
  await expect(sheet.locator('.dish-print-card')).toHaveCount(4)
  await expect(sheet.locator('img')).toHaveCount(0)
  await expect(sheet).not.toContainText('Себестоимость')
  await expect(sheet).not.toContainText('Маржа')
  await expect(sheet).not.toContainText('Горячее')

  await page.emulateMedia({ media: 'print' })
  await expect(sheet).toBeVisible()
  await expect(page.locator('#root')).toBeHidden()

  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  await expect(page.locator('body')).not.toHaveClass(/dish-printing/)
})

test('chef manages dish cards without financial access on mobile and desktop', async ({
  browser,
}) => {
  for (const viewport of [
    { width: 375, height: 812, suffix: 'мобильное' },
    { width: 1280, height: 800, suffix: 'настольное' },
  ]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, e2eUserEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)

    let releaseDishesRequest!: () => void
    const dishesRequestGate = new Promise<void>((resolve) => { releaseDishesRequest = resolve })
    const failDishesRequest = async (route: Route) => {
      await dishesRequestGate
      await route.abort()
    }
    await page.route('**/api/dishes', failDishesRequest)
    await page.goto('/app/dishes')
    await expect(page.getByRole('status', { name: 'Загрузка карт блюд' })).toBeVisible()
    releaseDishesRequest()
    await expect(page.getByText('Не удалось загрузить карты блюд')).toBeVisible()
    await page.unroute('**/api/dishes', failDishesRequest)
    const emptyDishesRequest = async (route: Route) => {
      const response = await route.fetch()
      const body = await response.json()
      await route.fulfill({ response, json: { ...body, dishes: [] } })
    }
    await page.route('**/api/dishes', emptyDishesRequest)
    await page.getByRole('button', { name: 'Повторить' }).click()
    await expect(page.getByRole('heading', { name: 'Добавьте первое блюдо' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Печать / PDF' })).toBeDisabled()
    await page.unroute('**/api/dishes', emptyDishesRequest)
    await page.reload()

    await expect(page.getByRole('heading', { name: 'Рабочий справочник кухни' })).toBeVisible()
    await expect(page.getByText('Себестоимость', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Цена', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Маржа', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Добавить блюдо' }).first().click()
    const dialog = page.getByRole('dialog', { name: 'Новое блюдо' })
    await expect(dialog.getByLabel('Цена продажи, ₽')).toHaveCount(0)
    await dialog.getByLabel('Название').fill('Каре ягнёнка с птитимом')
    await dialog.getByRole('button', { name: 'Сохранить карточку' }).click()
    await expect(dialog.getByText('Блюдо с таким названием уже существует')).toBeVisible()

    const dishName = `Блюдо E2E ${viewport.suffix}`
    await dialog.getByLabel('Название').fill(dishName)
    await dialog.getByLabel('Категория').fill('Проверка')
    await dialog.getByRole('button', { name: 'Добавить', exact: true }).click()
    await dialog.getByRole('button', { name: 'Сохранить карточку' }).click()
    await expect(dialog.getByText('Проверьте название, ингредиенты и количество. Один продукт нельзя добавить дважды.')).toBeVisible()
    await dialog.getByLabel('Продукт').nth(1).selectOption({ index: 1 })
    await dialog.getByLabel(/Количество/).nth(0).fill('0.2')
    await dialog.getByLabel(/Количество/).nth(1).fill('0.05')
    await dialog.getByRole('button', { name: 'Сохранить карточку' }).click()

    await expect(page.getByRole('dialog', { name: 'Новое блюдо' })).toHaveCount(0)
    await expect(page.getByText(dishName, { exact: true }).first()).toBeVisible()
    await page.getByLabel('Фото блюда').setInputFiles(pngImage)
    await expect(page.getByRole('img', { name: dishName }).first()).toBeVisible()

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await context.close()
  }
})
