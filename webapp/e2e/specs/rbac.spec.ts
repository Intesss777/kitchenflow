import { e2eAdminEmail, e2eAdminPassword, e2eUserEmail } from '../env'
import { expect, fillSignupForm, logIn, test, uniqueEmail } from '../helpers/test'

test('keeps owner and chef workspaces separate', async ({ browser, page }) => {
  await page.goto('/admin/users')
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fadmin%2Fusers$/)
  await page.getByTestId('signup-link').click()
  await fillSignupForm(page, uniqueEmail('web-e2e-rbac-user'))
  await page.getByTestId('signup-submit').click()

  await expect(page).toHaveURL(/\/admin\/users$/)
  await expect(page.getByTestId('nav-link-admin')).toBeVisible()
  await expect(page.getByTestId('nav-link-app')).toHaveCount(0)
  await page.goto('/app')
  await expect(page).toHaveURL(/\/admin$/)

  const chefContext = await browser.newContext()
  const chefPage = await chefContext.newPage()
  await chefPage.goto('/login')
  await logIn(chefPage, e2eUserEmail, e2eAdminPassword)

  await expect(chefPage).toHaveURL(/\/app$/)
  await expect(chefPage.getByTestId('primary-navigation')).toBeVisible()
  await expect(chefPage.getByTestId('nav-link-app')).toBeVisible()
  await expect(chefPage.getByTestId('nav-link-admin')).toHaveCount(0)
  await chefPage.goto('/admin/users')
  await expect(chefPage).toHaveURL(/\/app$/)

  await chefContext.close()
})

test('chef home quick-access cards open permitted routes on mobile and desktop', async ({ browser }) => {
  const viewports = [
    { width: 375, height: 812 },
    { width: 1280, height: 800 },
  ]
  const cards = [
    { name: 'Склад', path: '/app/inventory' },
    { name: 'Закупка', path: '/app/purchases' },
    { name: 'Карты блюд', path: '/app/dishes' },
    { name: 'Команда', path: '/app/staff' },
  ]

  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    await page.goto('/login')
    await logIn(page, e2eUserEmail, e2eAdminPassword)
    await expect(page).toHaveURL(/\/app$/)
    const quickAccess = page.getByRole('region', { name: 'Разделы' })

    for (const card of cards) {
      await quickAccess.getByRole('link', { name: card.name, exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`${card.path}$`))
      await page.goBack()
      await expect(page).toHaveURL(/\/app$/)
    }

    await context.close()
  }
})

test('changing a chef to administrator revokes the old session and opens the admin workspace after login', async ({
  browser,
  page,
}) => {
  await page.goto('/login')
  await logIn(page, e2eUserEmail, e2eAdminPassword)
  await expect(page).toHaveURL(/\/app$/)

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await adminPage.goto('/login')
  await logIn(adminPage, e2eAdminEmail, e2eAdminPassword)
  await adminPage.getByTestId('nav-link-admin-users').click()
  await expect(adminPage).toHaveURL(/\/admin\/users$/)

  await adminPage.getByTestId('user-search-input').fill(e2eUserEmail)
  await adminPage.getByTestId('user-search-submit').click()
  const userRow = adminPage.getByTestId('user-row').filter({ hasText: e2eUserEmail })
  // The unfiltered page always lists the administrator too, so one row means the search applied.
  await expect(adminPage.getByTestId('user-row')).toHaveCount(1)
  await userRow.getByTestId('role-select').click()
  await adminPage.getByTestId('role-option-administrator').click()
  await adminPage.getByTestId('role-change-confirm').click()
  await expect(adminPage.getByTestId('role-change-success')).toBeVisible()

  // The role change revoked the user's sessions, so a reload has nothing to restore.
  await page.reload()
  await expect(page.getByTestId('login-form')).toBeVisible()
  await logIn(page, e2eUserEmail, e2eAdminPassword)

  await expect(page).toHaveURL(/\/admin\/inventory$/)
  await expect(page.getByTestId('nav-link-admin-inventory')).toBeVisible()
  await expect(page.getByTestId('nav-link-app')).toHaveCount(0)

  await adminContext.close()
})
