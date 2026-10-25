import type {
  CreateInvoiceUploadRequest,
  PurchaseInvoice,
  PurchaseInvoiceListQuery,
  PurchaseInvoiceListResponse,
  UpdatePurchaseInvoiceRequest,
} from '@kitchenflow/contracts'

import type { PrivateStorage } from '../../../storage/port'

export type { PrivateStorage }

export type InvoiceUploadRecord = {
  id: string
  objectKey: string
  contentType: CreateInvoiceUploadRequest['contentType']
  byteSize: number
  uploadExpiresAt: Date
  status: PurchaseInvoice['status']
}

export type InvoicesRepository = {
  createPending(input: {
    userId: string
    objectKey: string
    contentType: CreateInvoiceUploadRequest['contentType']
    byteSize: number
    uploadExpiresAt: Date
  }): Promise<string>
  findUpload(userId: string, invoiceId: string): Promise<InvoiceUploadRecord | null>
  markRejected(userId: string, invoiceId: string): Promise<void>
  recognize(userId: string, invoiceId: string, now: Date): Promise<PurchaseInvoice>
  list(
    userId: string,
    query: PurchaseInvoiceListQuery,
    now: Date,
  ): Promise<PurchaseInvoiceListResponse>
  read(userId: string, invoiceId: string): Promise<PurchaseInvoice>
  update(
    userId: string,
    invoiceId: string,
    input: UpdatePurchaseInvoiceRequest,
  ): Promise<PurchaseInvoice>
  confirm(userId: string, invoiceId: string, now: Date): Promise<PurchaseInvoice>
}

export type InvoiceObjectKeyFactory = {
  create(now: Date): string
}
