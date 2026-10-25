import { expect, test } from 'bun:test'

import { ApiRequestError } from '@/platform/api'
import { credentialsErrorMessage } from '@/features/users/credentials-error'

test('credential failures are explained in Russian without exposing backend wording', () => {
  expect(
    credentialsErrorMessage(new ApiRequestError(401, 'UNAUTHORIZED', 'Current password is incorrect')),
  ).toBe('Текущий пароль указан неверно.')
  expect(
    credentialsErrorMessage(new ApiRequestError(409, 'CONFLICT', 'User with this email already exists')),
  ).toBe('Этот email уже используется другим аккаунтом.')
  expect(credentialsErrorMessage(new Error('database unavailable'))).toBe(
    'Не удалось обновить данные входа. Проверьте соединение и повторите попытку.',
  )
})
