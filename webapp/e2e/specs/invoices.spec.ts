import { e2eAdminEmail, e2eAdminPassword } from '../env'
import { pngImage } from '../helpers/images'
import { expect, logIn, test } from '../helpers/test'

test('invoice controls use practical steps and every primary action works', async ({ page }) => {
  await page.goto('/login')
  await logIn(page, e2eAdminEmail, e2eAdminPassword)
  await page.getByTestId('nav-link-admin-invoices').click()
  await expect(page).toHaveURL(/\/admin\/invoices$/)

  const invoiceCard = page.getByRole('button', { name: /МТ-12041/ })
  await expect(invoiceCard).toBeEnabled()
  await invoiceCard.click()

  const quantity = page.getByLabel('Количество, кг').first()
  const price = page.getByLabel('Цена, ₽').first()
  await expect(quantity).toHaveValue('3.5')
  await expect(price).toHaveValue('1450')

  await quantity.press('ArrowUp')
  await price.press('ArrowUp')
  await expect(quantity).toHaveValue('3.6')
  await expect(price).toHaveValue('1451')

  const saved = page.waitForResponse((response) =>
    response.request().method() === 'PATCH' && /\/api\/invoices\/[^/]+$/.test(response.url()),
  )
  await page.getByRole('button', { name: 'Сохранить проверку' }).click()
  expect((await saved).ok()).toBe(true)

  const confirmed = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/confirm'),
  )
  await page.getByRole('button', { name: 'Подтвердить накладную' }).click()
  expect((await confirmed).ok()).toBe(true)
  await expect(page.getByText('Накладная проведена')).toBeVisible()

  const chooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Фото накладной' }).click()
  const chooser = await chooserPromise
  const finalized = page.waitForResponse((response) =>
    response.request().method() === 'POST' && response.url().endsWith('/finalize'),
  )
  await chooser.setFiles({
    name: 'invoice.png',
    mimeType: pngImage.mimeType,
    buffer: pngImage.buffer,
  })
  expect((await finalized).ok()).toBe(true)
  await expect(page.getByText('Проверка накладной')).toBeVisible()
})
