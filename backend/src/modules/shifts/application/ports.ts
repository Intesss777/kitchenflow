import type {
  CreateSalesReceiptUploadRequest,
  SalesShift,
  SalesShiftsOverviewResponse,
  UpdateSalesShiftRequest,
} from '@kitchenflow/contracts'

import type { PrivateStorage } from '../../../storage/port'

export type { PrivateStorage }

export type SalesReceiptUploadRecord = {
  id: string
  shiftId: string
  objectKey: string
  contentType: CreateSalesReceiptUploadRequest['contentType']
  byteSize: number
  uploadExpiresAt: Date
  status: 'upload_pending' | 'recognized' | 'rejected'
}

export type ShiftsRepository = {
  createPending(input: {
    userId: string
    shiftDate: string
    objectKey: string
    contentType: CreateSalesReceiptUploadRequest['contentType']
    byteSize: number
    uploadExpiresAt: Date
  }): Promise<{ shiftId: string; receiptId: string }>
  findUpload(userId: string, receiptId: string): Promise<SalesReceiptUploadRecord | null>
  markRejected(userId: string, receiptId: string): Promise<void>
  recognize(userId: string, receiptId: string, now: Date): Promise<string>
  list(userId: string, now: Date): Promise<SalesShiftsOverviewResponse>
  read(userId: string, shiftId: string): Promise<SalesShift>
  receiptObjects(userId: string, shiftId: string): Promise<Array<{ id: string; objectKey: string }>>
  update(userId: string, shiftId: string, input: UpdateSalesShiftRequest): Promise<SalesShift>
  confirm(userId: string, shiftId: string, now: Date): Promise<SalesShift>
}

export type SalesReceiptObjectKeyFactory = { create(now: Date): string }
