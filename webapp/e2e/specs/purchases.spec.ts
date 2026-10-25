import { e2eAdminEmail, e2eAdminPassword, e2eUserEmail } from '../env'
import { expect, logIn, test } from '../helpers/test'

test('edits purchase quantities without flicker, reordering, or forced decimals', async ({
  page,
}) => {
  await page.goto('/login')
  await logIn(page, e2eAdminEmail, e2eAdminPassword)
  await page.getByTestId('nav-link-admin-purchases').click()
  await expect(page).toHaveURL(/\/admin\/purchases$/)

  const cheese = page.getByRole('spinbutton', {
    name: 'Количество Сыр сливочный',
  })
  await expect(cheese).toHaveValue('3')
  const initialOrder = await quantityInputLabels(page)

  let saved = page.waitForResponse(isDraftSave)
  await page.getByRole('button', {
    name: 'Увеличить Сыр сливочный на единицу',
  }).click()
  await expect(cheese).toHaveValue('4')
  await expect(page.getByLabel('Загрузка закупки')).toHaveCount(0)
  await saved
  expect(await quantityInputLabels(page)).toEqual(initialOrder)

  await cheese.fill('')
  await expect(cheese).toHaveValue('')
  await cheese.fill('7.5')
  saved = page.waitForResponse(isDraftSave)
  await cheese.blur()
  await saved
  await expect(cheese).toHaveValue('7.5')

  await cheese.press('ArrowUp')
  await expect(cheese).toHaveValue('7.6')
  saved = page.waitForResponse(isDraftSave)
  await cheese.blur()
  await saved

  saved = page.waitForResponse(isDraftSave)
  await page.getByRole('button', {
    name: 'Увеличить Сыр сливочный на единицу',
  }).click()
  await saved
  await expect(cheese).toHaveValue('8.6')

  saved = page.waitForResponse(isDraftSave)
  await page.getByRole('button', { name: 'Добавить Контейнер 750 мл' }).click()
  await saved
  const container = page.getByRole('spinbutton', {
    name: 'Количество Контейнер 750 мл',
  })
  await expect(container).toHaveValue('1')

  await container.press('ArrowUp')
  await expect(container).toHaveValue('2')
  saved = page.waitForResponse(isDraftSave)
  await container.blur()
  await saved

  await page.reload()
  await expect(page.getByRole('spinbutton', {
    name: 'Количество Сыр сливочный',
  })).toHaveValue('8.6')
  await expect(page.getByRole('spinbutton', {
    name: 'Количество Контейнер 750 мл',
  })).toHaveValue('2')
})

test('chef edits and prepares a purchase without seeing prices', async ({ browser }) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ]) {
    const context = await browser.newContext({
      viewport,
      permissions: ['clipboard-read', 'clipboard-write'],
    })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, e2eUserEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)
    await page.goto('/app/purchases')
    await expect(page).toHaveURL(/\/app\/purchases$/)
    await expect(page.getByText('Ориентировочная сумма')).toHaveCount(0)
    await expect(page.getByText('Добавить прошлые цены для сверки')).toHaveCount(0)

    let saved = page.waitForResponse(isDraftSave)
    await page.getByRole('button', { name: 'Добавить Контейнер 750 мл' }).click()
    await saved

    if (viewport.width < 1024) {
      await page.getByRole('tab', { name: /^Закупка/ }).click()
    }
    const cheese = page.getByRole('spinbutton', { name: 'Количество Сыр сливочный' })
    const prepare = page.getByRole('button', { name: 'Подготовить для WhatsApp' })
    await cheese.fill('')
    await expect(prepare).toBeDisabled()
    await cheese.fill('4.5')
    saved = page.waitForResponse(isDraftSave)
    await cheese.blur()
    await saved
    await expect(cheese).toHaveValue('4.5')

    saved = page.waitForResponse(isDraftSave)
    await page.getByRole('button', { name: 'Увеличить Сыр сливочный на единицу' }).click()
    await saved
    await expect(cheese).toHaveValue('5.5')
    saved = page.waitForResponse(isDraftSave)
    await page.getByRole('button', { name: 'Уменьшить Сыр сливочный на единицу' }).click()
    await saved
    await expect(cheese).toHaveValue('4.5')

    saved = page.waitForResponse(isDraftSave)
    await page.getByRole('button', { name: 'Удалить Контейнер 750 мл' }).click()
    await saved
    await page.getByLabel('Комментарий закупщику').fill('Проверка закупки chef')
    saved = page.waitForResponse(isDraftSave)
    await page.getByLabel('Комментарий закупщику').blur()
    await saved

    await prepare.click()
    const message = page.getByLabel('Подготовленное сообщение')
    await expect(message).toHaveValue(/Проверка закупки chef/)
    await expect(message).not.toHaveValue(/₽/)
    const whatsapp = page.getByRole('link', { name: 'Открыть WhatsApp' })
    await expect(whatsapp).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/)
    await page.getByRole('button', { name: 'Скопировать' }).click()
    await expect(page.getByRole('button', { name: 'Скопировано' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Сообщение для закупщика' })).toHaveCount(0)

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await context.close()
  }
})

function isDraftSave(response: { request(): { method(): string }; url(): string }) {
  return response.request().method() === 'PUT' && response.url().endsWith('/api/purchases/draft')
}

async function quantityInputLabels(page: import('@playwright/test').Page) {
  return page.getByRole('spinbutton').evaluateAll((inputs) =>
    inputs.map((input) => input.getAttribute('aria-label')),
  )
}
