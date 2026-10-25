import type {
  PreparePurchaseMessageRequest,
  SavePurchaseDraftRequest,
} from '@kitchenflow/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import { getPurchaseDraft, preparePurchaseMessage, savePurchaseDraft } from './api'

export const purchasesQueryKeys = {
  all: ['session', 'purchases'] as const,
  draft: () => [...purchasesQueryKeys.all, 'draft'] as const,
}

export function usePurchaseDraftQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: purchasesQueryKeys.draft(),
    queryFn: ({ signal }) => getPurchaseDraft(auth.transport, { signal }),
  })
}

export function useSavePurchaseDraftMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    scope: { id: 'purchase-draft-save' },
    mutationFn: (input: SavePurchaseDraftRequest) => savePurchaseDraft(auth.transport, input),
    onSuccess: (draft) => {
      queryClient.setQueryData(purchasesQueryKeys.draft(), draft)
    },
  })
}

export function usePreparePurchaseMessageMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: PreparePurchaseMessageRequest) => preparePurchaseMessage(auth.transport, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: purchasesQueryKeys.draft() })
    },
  })
}
