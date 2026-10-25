import { updateProfileRequestSchema, type UpdateProfileRequest } from '@kitchenflow/contracts'

import { toValidationErrors, type ValidationErrors } from '@/features/auth'

export type ProfileFormValidation =
  | { request: UpdateProfileRequest; errors: null }
  | { request: null; errors: ValidationErrors }

/**
 * Runs the profile form through the shared request contract so the client accepts exactly what
 * the server does. An empty field means "clear the name", which the contract spells as `null`.
 */
export function validateProfileForm(displayName: string): ProfileFormValidation {
  const result = updateProfileRequestSchema.safeParse({
    displayName: displayName.trim() === '' ? null : displayName,
  })
  if (result.success) return { request: result.data, errors: null }

  const errors = toValidationErrors(result.error.issues)
  if (errors.fieldErrors.displayName?.length) {
    errors.fieldErrors.displayName = [
      { message: 'Имя должно содержать от 2 до 80 символов.' },
    ]
  }
  return { request: null, errors }
}
