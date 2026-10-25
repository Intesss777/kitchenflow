import { e2eAdminEmail, e2eAdminPassword, e2eUserEmail } from '../env'
import { expect, logIn, test } from '../helpers/test'

test('adds, edits, and safely removes an inventory product', async ({ page }) => {
  await page.goto('/login')
  await logIn(page, e2eAdminEmail, e2eAdminPassword)
  await page.getByTestId('nav-link-admin-inventory').click()
  await expect(page).toHaveURL(/\/admin\/inventory$/)

  await page.getByRole('button', { name: 'Добавить', exact: true }).click()
  await page.getByLabel('Название').fill('Товар E2E')
  await page.getByLabel('Категория').fill('Проверка')
  await page.getByLabel('Единица').selectOption('piece')
  await page.getByLabel('Минимальный остаток').fill('2')
  await page.getByLabel('Закупочная цена за единицу, ₽').fill('50')
  await page.getByRole('button', { name: 'Добавить товар' }).click()

  await expect(page.getByRole('heading', { name: 'Товар E2E' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Редактировать Товар E2E' }).click()
  await page.getByLabel('Название').fill('Товар E2E исправленный')
  await page.getByLabel('Минимальный остаток').fill('3')
  await page.getByRole('button', { name: 'Сохранить' }).click()

  await expect(page.getByRole('button', {
    name: 'Редактировать Товар E2E исправленный',
  })).toBeVisible()
  await page.getByRole('button', { name: 'Удалить', exact: true }).click()
  await page.getByLabel('Товар', { exact: true }).selectOption({
    label: 'Товар E2E исправленный',
  })
  await page.getByRole('button', { name: 'Удалить товар' }).click()

  await expect(page.getByRole('button', {
    name: 'Редактировать Товар E2E исправленный',
  })).toHaveCount(0)
})

test('chef audits inventory and records movements without cost access', async ({ browser }) => {
  for (const viewport of [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, e2eUserEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)
    await page.goto('/app/inventory')
    await expect(page).toHaveURL(/\/app\/inventory$/)

    await expect(page.getByRole('button', { name: 'Добавить', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Удалить', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Редактировать / })).toHaveCount(0)
    await expect(page.getByLabel(/Все позиции:/)).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('inventory-filter-danger').click()
    await expect(page.getByTestId('inventory-filter-danger')).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('inventory-filter-default').click()

    await page.getByRole('button', { name: /^Лосось филе/ }).click()
    await expect(page.getByRole('heading', { name: 'Лосось филе' })).toBeVisible()
    await expect(page.getByText('Цена за единицу', { exact: true })).toHaveCount(0)

    await page.getByRole('button', { name: 'Приход', exact: true }).click()
    await expect(page.getByLabel('Цена за единицу, ₽')).toHaveCount(0)
    const receiptQuantity = page.getByLabel(/Количество/)
    await receiptQuantity.fill('0')
    await page.getByRole('button', { name: 'Приход', exact: true }).click()
    await expect(receiptQuantity).toHaveJSProperty('validity.valid', false)
    await receiptQuantity.fill('0.1')
    await page.getByLabel('Накладная').fill('E2E chef')
    await page.getByLabel('Комментарий').fill('Проверка прихода')
    await page.getByRole('button', { name: 'Приход', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Принять на склад' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Списать', exact: true }).click()
    await page.getByLabel(/Количество/).fill('999')
    await page.getByRole('button', { name: 'Списание', exact: true }).click()
    await expect(page.getByText('Операция не сохранена', { exact: true })).toBeVisible()
    await expect(page.getByText('Количество списания превышает текущий остаток')).toBeVisible()
    await page.getByLabel(/Количество/).fill('0.1')
    await page.getByLabel('Комментарий').fill('Проверка списания')
    await page.getByRole('button', { name: 'Списание', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Списать со склада' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Пересчёт', exact: true }).click()
    await page.getByLabel(/Фактический остаток/).fill('6.8')
    await page.getByLabel('Комментарий').fill('Проверка пересчёта')
    await page.getByRole('button', { name: 'Пересчёт', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Зафиксировать пересчёт' })).toHaveCount(0)
    await expect(page.getByText('Проверка пересчёта').first()).toBeVisible()

    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await context.close()
  }
})
