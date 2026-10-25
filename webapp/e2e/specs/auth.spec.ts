import {
  expect,
  fillSignupForm,
  logIn,
  logOut,
  signUp,
  test,
  uniqueEmail,
} from '../helpers/test'

test('registers, restores the session, opens protected UI, and logs out', async ({ page }) => {
  const email = uniqueEmail()
  const displayName = 'Web E2E User'

  await signUp(page, email, displayName)

  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByTestId('primary-navigation')).toBeVisible()
  await expect(page.getByTestId('nav-link-admin')).toBeVisible()
  await expect(page.getByTestId('nav-link-app')).toHaveCount(0)
  await page.getByTestId('account-menu').click()
  await expect(page.getByTestId('current-user-email')).toHaveText(email)
  await page.keyboard.press('Escape')

  // The access token lives in memory, so after a reload only the refresh cookie can sign in.
  await page.reload()
  await page.getByTestId('account-menu').click()
  await expect(page.getByTestId('current-user-email')).toHaveText(email)

  await logOut(page)
  await expect(page.getByTestId('login-form')).toBeVisible()
  await logIn(page, email)
  await expect(page).toHaveURL(/\/admin$/)
})

test('shows generic forgot-password success and handles an invalid reset link', async ({ page }) => {
  await page.goto('/login')
  await page.getByTestId('forgot-password-link').click()
  await expect(page).toHaveURL(/\/forgot-password$/)

  await page.getByTestId('forgot-password-email').fill(uniqueEmail('unknown-reset'))
  await page.getByTestId('forgot-password-submit').click()
  await expect(page.getByTestId('forgot-password-accepted')).toBeVisible()

  await page.goto('/reset-password#token=truncated')
  await expect(page).toHaveURL(/\/reset-password$/)
  await expect(page.getByTestId('reset-password-submit')).toBeDisabled()
})

test('keeps one logical browser session active across concurrent tabs', async ({ page }) => {
  const email = uniqueEmail('web-e2e-tabs')

  await signUp(page, email)
  await expect(page).toHaveURL(/\/admin$/)

  const secondPage = await page.context().newPage()
  await secondPage.goto('/')
  await expect(secondPage).toHaveURL(/\/admin$/)

  await Promise.all([page.reload(), secondPage.reload()])

  await page.getByTestId('account-menu').click()
  await expect(page.getByTestId('current-user-email')).toHaveText(email)
  await page.keyboard.press('Escape')
  await secondPage.getByTestId('account-menu').click()
  await expect(secondPage.getByTestId('current-user-email')).toHaveText(email)
  await secondPage.keyboard.press('Escape')

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Temporary logout failure' } }),
    })
  })
  await logOut(page)
  await expect(page.getByTestId('logout-error')).toBeVisible()
  await expect(page.getByTestId('current-user-email')).toHaveText(email)

  await logOut(secondPage)
  await expect(secondPage.getByTestId('login-form')).toBeVisible()
  await expect(page.getByTestId('login-form')).toBeVisible()
})

test('concurrent account changes converge every tab on the winning cookie session', async ({ page }) => {
  const firstEmail = uniqueEmail('web-e2e-account-a')
  const secondEmail = uniqueEmail('web-e2e-account-b')
  const secondPage = await page.context().newPage()

  await Promise.all([page.goto('/signup'), secondPage.goto('/signup')])
  await fillSignupForm(page, firstEmail)
  await fillSignupForm(secondPage, secondEmail)

  await Promise.all([
    page.getByTestId('signup-submit').click(),
    secondPage.getByTestId('signup-submit').click(),
  ])

  await expect(page).toHaveURL(/\/admin$/)
  await expect(secondPage).toHaveURL(/\/admin$/)
  await page.getByTestId('account-menu').click()
  await secondPage.getByTestId('account-menu').click()
  await expect
    .poll(async () => {
      const [firstTab, secondTab] = await Promise.all(
        [page, secondPage].map((tab) => tab.getByTestId('current-user-email').allTextContents()),
      )
      const signedInEmail = firstTab.length === 1 ? firstTab[0] : undefined
      return signedInEmail !== undefined &&
        secondTab.length === 1 &&
        secondTab[0] === signedInEmail &&
        [firstEmail, secondEmail].includes(signedInEmail)
    })
    .toBe(true)
})
