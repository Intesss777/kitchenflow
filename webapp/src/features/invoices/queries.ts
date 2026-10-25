import type { PurchaseInvoiceListQuery, UpdatePurchaseInvoiceRequest } from '@kitchenflow/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/features/auth'
import {
  confirmPurchaseInvoice,
  createInvoiceUpload,
  finalizeInvoiceUpload,
  getPurchaseInvoice,
  getPurchaseInvoices,
  updatePurchaseInvoice,
} from './api'
import { describeInvoiceFile, uploadInvoiceObject } from './upload'

export const invoiceQueryKeys = {
  all: ['session', 'invoices'] as const,
  lists: () => [...invoiceQueryKeys.all, 'list'] as const,
  list: (query: PurchaseInvoiceListQuery) => [...invoiceQueryKeys.lists(), query] as const,
  detail: (invoiceId: string) => [...invoiceQueryKeys.all, 'detail', invoiceId] as const,
}

export function usePurchaseInvoicesQuery(query: PurchaseInvoiceListQuery) {
  const auth = useAuth()
  return useQuery({
    queryKey: invoiceQueryKeys.list(query),
    queryFn: ({ signal }) => getPurchaseInvoices(auth.transport, query, { signal }),
    placeholderData: (previousData) => previousData,
  })
}

export function usePurchaseInvoiceQuery(invoiceId: string | null) {
  const auth = useAuth()
  return useQuery({
    queryKey: invoiceQueryKeys.detail(invoiceId ?? 'none'),
    queryFn: ({ signal }) => getPurchaseInvoice(auth.transport, invoiceId!, { signal }),
    enabled: invoiceId !== null,
  })
}

export function useUploadInvoiceMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) => {
      const description = describeInvoiceFile(file)
      const { upload } = await createInvoiceUpload(auth.transport, description)
      await uploadInvoiceObject(upload, file)
      return finalizeInvoiceUpload(auth.transport, upload.uploadId)
    },
    onSuccess: async (response) => {
      queryClient.setQueryData(invoiceQueryKeys.detail(response.invoice.id), response)
      await queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.lists() })
    },
  })
}

export function useUpdateInvoiceMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ invoiceId, input }: { invoiceId: string; input: UpdatePurchaseInvoiceRequest }) =>
      updatePurchaseInvoice(auth.transport, invoiceId, input),
    onSuccess: async (response) => {
      queryClient.setQueryData(invoiceQueryKeys.detail(response.invoice.id), response)
      await queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.lists() })
    },
  })
}

export function useConfirmInvoiceMutation() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (invoiceId: string) => confirmPurchaseInvoice(auth.transport, invoiceId),
    onSuccess: async (response) => {
      queryClient.setQueryData(invoiceQueryKeys.detail(response.invoice.id), response)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: invoiceQueryKeys.lists() }),
        queryClient.invalidateQueries({ queryKey: ['session', 'inventory'] }),
        queryClient.invalidateQueries({ queryKey: ['session', 'operations'] }),
      ])
    },
  })
}
