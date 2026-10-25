import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  SALES_RECEIPT_MAX_BYTES,
  SALES_RECEIPT_MIN_BYTES,
  type UploadTicket,
} from '@kitchenflow/contracts'

import {
  describeSalesReceiptFile,
  SalesReceiptUploadError,
  uploadSalesReceiptObject,
} from '@/features/shifts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

function file(name: string, type: string, size: number) {
  return new File([new Uint8Array(size)], name, { type })
}

function ticket(contentLength: number): UploadTicket {
  return {
    uploadId: '019c0000-0000-7000-8000-000000000101',
    method: 'PUT',
    url: 'http://127.0.0.1:24331/local-private-storage/sales-receipts/receipt?x-sig=1',
    headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
    contentLength,
    expiresAt: '2026-10-11T20:15:00.000Z',
  }
}

describe('sales receipt photo upload', () => {
  test('accepts phone formats and rejects invalid file sizes', () => {
    expect(describeSalesReceiptFile(file('receipt.HEIC', '', 2048))).toEqual({
      contentType: 'image/heic',
      byteSize: 2048,
    })
    expect(() => describeSalesReceiptFile(file('receipt.pdf', 'application/pdf', 2048))).toThrow(
      SalesReceiptUploadError,
    )
    expect(() => describeSalesReceiptFile(file('receipt.jpg', 'image/jpeg', SALES_RECEIPT_MIN_BYTES - 1))).toThrow('повреждён')
    expect(() => describeSalesReceiptFile(file('receipt.jpg', 'image/jpeg', SALES_RECEIPT_MAX_BYTES + 1))).toThrow('меньше 15 МБ')
  })

  test('uploads with the signed headers and no browser credentials', async () => {
    const calls: Array<[string, RequestInit]> = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      calls.push([url, init])
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const photo = file('receipt.png', 'image/png', 2048)
    await uploadSalesReceiptObject(ticket(2048), photo)

    expect(calls).toHaveLength(1)
    expect(calls[0][1]).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
      credentials: 'omit',
      body: photo,
    })
  })
})
