import { expect, test } from 'bun:test'

import { validateProfileForm } from '../src/features/users/profile-form'

const tooShortName = 'A'
const tooLongName = 'x'.repeat(81)

test('a one-character name is rejected with an actionable Russian message', () => {
  const validation = validateProfileForm(tooShortName)

  expect(validation.request).toBeNull()
  expect(validation.errors?.fieldErrors.displayName).toEqual([
    { message: 'Имя должно содержать от 2 до 80 символов.' },
  ])
  expect(validation.errors?.formError).toBeNull()
})

test('an 81-character name is rejected with an actionable Russian message', () => {
  const validation = validateProfileForm(tooLongName)

  expect(validation.request).toBeNull()
  expect(validation.errors?.fieldErrors.displayName).toEqual([
    { message: 'Имя должно содержать от 2 до 80 символов.' },
  ])
  expect(validation.errors?.formError).toBeNull()
})

test('names inside the contract bounds are trimmed and accepted', () => {
  expect(validateProfileForm('  Jane Doe  ')).toEqual({
    request: { displayName: 'Jane Doe' },
    errors: null,
  })
  expect(validateProfileForm('ab')).toEqual({ request: { displayName: 'ab' }, errors: null })
  expect(validateProfileForm('y'.repeat(80))).toEqual({
    request: { displayName: 'y'.repeat(80) },
    errors: null,
  })
})

test('an empty or whitespace-only name clears the display name instead of failing', () => {
  expect(validateProfileForm('')).toEqual({ request: { displayName: null }, errors: null })
  expect(validateProfileForm('   ')).toEqual({ request: { displayName: null }, errors: null })
})
