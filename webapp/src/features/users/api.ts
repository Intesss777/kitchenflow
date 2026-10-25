import {
  updateCredentialsRequestSchema,
  updateCredentialsResponseSchema,
  updateProfileRequestSchema,
  updateProfileResponseSchema,
  type UpdateProfileRequest,
  type UpdateCredentialsRequest,
} from '@kitchenflow/contracts'

import type { AuthenticatedTransport } from '@/platform/api'

export function updateProfile(
  transport: AuthenticatedTransport,
  input: UpdateProfileRequest,
) {
  return transport.request(
    '/api/users/me',
    updateProfileResponseSchema,
    {
      method: 'PATCH',
      body: updateProfileRequestSchema.parse(input),
    },
  )
}

export function updateCredentials(
  transport: AuthenticatedTransport,
  input: UpdateCredentialsRequest,
) {
  return transport.request(
    '/api/auth/credentials',
    updateCredentialsResponseSchema,
    { method: 'PATCH', body: updateCredentialsRequestSchema.parse(input) },
  )
}
