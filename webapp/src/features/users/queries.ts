import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { MeResponse, UpdateCredentialsRequest } from '@kitchenflow/contracts'

import { authQueryKeys, useAuth } from '@/features/auth'
import { updateCredentials, updateProfile } from './api'

export function useUpdateProfileMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (displayName: string | null) =>
      updateProfile(auth.transport, { displayName }),
    onSuccess: (response) => {
      queryClient.setQueryData(
        authQueryKeys.me(),
        { user: response.user } satisfies MeResponse,
      )
    },
  })
}

export function useUpdateCredentialsMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateCredentialsRequest) => updateCredentials(auth.transport, input),
    onSuccess: (response) => {
      queryClient.setQueryData(
        authQueryKeys.me(),
        { user: response.user } satisfies MeResponse,
      )
    },
  })
}
