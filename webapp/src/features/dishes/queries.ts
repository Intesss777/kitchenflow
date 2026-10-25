import type { SaveDishCardRequest } from '@kitchenflow/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import {
  createDishCard,
  createDishPhotoUpload,
  finalizeDishPhotoUpload,
  getDishCards,
  updateDishCard,
} from './api'
import { describeDishPhoto, uploadDishPhotoObject } from './upload'

export const dishesQueryKeys = { all: ['session', 'dishes'] as const }

export function useDishCardsQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: dishesQueryKeys.all,
    queryFn: ({ signal }) => getDishCards(auth.transport, { signal }),
  })
}

export function useSaveDishCardMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ dishId, input }: { dishId: string | null; input: SaveDishCardRequest }) =>
      dishId
        ? updateDishCard(auth.transport, dishId, input)
        : createDishCard(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dishesQueryKeys.all })
    },
  })
}

export function useUploadDishPhotoMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ dishId, file }: { dishId: string; file: File }) => {
      const description = describeDishPhoto(file)
      const response = await createDishPhotoUpload(auth.transport, dishId, description)
      await uploadDishPhotoObject(response.upload, file)
      return finalizeDishPhotoUpload(auth.transport, dishId, response.upload.uploadId)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: dishesQueryKeys.all })
    },
  })
}
