import type { UpdateSalesShiftRequest } from '@kitchenflow/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import {
  confirmSalesShift,
  createSalesReceiptUpload,
  finalizeSalesReceiptUpload,
  getSalesShift,
  getSalesShifts,
  updateSalesShift,
} from './api'
import { describeSalesReceiptFile, uploadSalesReceiptObject } from './upload'

export const shiftsQueryKeys = {
  all: ['session', 'shifts'] as const,
  list: () => [...shiftsQueryKeys.all, 'list'] as const,
  detail: (shiftId: string) => [...shiftsQueryKeys.all, 'detail', shiftId] as const,
}

export function useSalesShiftsQuery() {
  const auth = useAuth()
  return useQuery({
    queryKey: shiftsQueryKeys.list(),
    queryFn: ({ signal }) => getSalesShifts(auth.transport, { signal }),
  })
}

export function useSalesShiftQuery(shiftId: string | null) {
  const auth = useAuth()
  return useQuery({
    queryKey: shiftsQueryKeys.detail(shiftId ?? 'none'),
    queryFn: ({ signal }) => getSalesShift(auth.transport, shiftId!, { signal }),
    enabled: shiftId !== null,
  })
}

export function useUploadSalesReceiptMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, shiftDate }: { file: File; shiftDate: string }) => {
      const description = describeSalesReceiptFile(file)
      const { upload } = await createSalesReceiptUpload(auth.transport, {
        ...description,
        shiftDate,
      })
      await uploadSalesReceiptObject(upload, file)
      return finalizeSalesReceiptUpload(auth.transport, upload.uploadId)
    },
    onSuccess: async (response) => {
      queryClient.setQueryData(shiftsQueryKeys.detail(response.shift.id), response)
      await queryClient.invalidateQueries({ queryKey: shiftsQueryKeys.list() })
    },
  })
}

export function useUpdateSalesShiftMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ shiftId, input }: { shiftId: string; input: UpdateSalesShiftRequest }) =>
      updateSalesShift(auth.transport, shiftId, input),
    onSuccess: async (response) => {
      queryClient.setQueryData(shiftsQueryKeys.detail(response.shift.id), response)
      await queryClient.invalidateQueries({ queryKey: shiftsQueryKeys.list() })
    },
  })
}

export function useConfirmSalesShiftMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (shiftId: string) => confirmSalesShift(auth.transport, shiftId),
    onSuccess: async (response) => {
      queryClient.setQueryData(shiftsQueryKeys.detail(response.shift.id), response)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: shiftsQueryKeys.list() }),
        queryClient.invalidateQueries({ queryKey: ['session', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['session', 'operations'] }),
        queryClient.invalidateQueries({ queryKey: ['session', 'purchases'] }),
      ])
    },
  })
}
