import { ApiRequestError } from '@/platform/api'

export function credentialsErrorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'Текущий пароль указан неверно.'
    if (error.code === 'CONFLICT') return 'Этот email уже используется другим аккаунтом.'
  }

  return 'Не удалось обновить данные входа. Проверьте соединение и повторите попытку.'
}
