import { afterEach, describe, expect, mock, test } from 'bun:test'
import { INVOICE_MAX_BYTES, INVOICE_MIN_BYTES, type UploadTicket } from '@kitchenflow/contracts'

import {
  describeInvoiceFile,
  InvoiceUploadError,
  uploadInvoiceObject,
} from '@/features/invoices'

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
    url: 'http://127.0.0.1:24331/local-private-storage/invoices/2026/10/abc?x-sig=1',
    headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
    contentLength,
    expiresAt: '2026-10-11T20:15:00.000Z',
  }
}

describe('describeInvoiceFile', () => {
  test('accepts camera formats and falls back to the file extension', () => {
    expect(describeInvoiceFile(file('invoice.png', 'image/png', 2048))).toEqual({
      contentType: 'image/png',
      byteSize: 2048,
    })
    expect(describeInvoiceFile(file('invoice.HEIC', '', 2048))).toEqual({
      contentType: 'image/heic',
      byteSize: 2048,
    })
  })

  test('rejects unsupported, empty, and oversized files', () => {
    expect(() => describeInvoiceFile(file('invoice.pdf', 'application/pdf', 2048))).toThrow(
      InvoiceUploadError,
    )
    expect(() => describeInvoiceFile(file('invoice.png', 'image/png', INVOICE_MIN_BYTES - 1))).toThrow(
      'повреждён',
    )
    expect(() => describeInvoiceFile(file('invoice.png', 'image/png', INVOICE_MAX_BYTES + 1))).toThrow(
      'меньше 15 МБ',
    )
  })
})

describe('uploadInvoiceObject', () => {
  test('uses the signed ticket exactly and sends no browser credentials', async () => {
    const calls: Array<[string, RequestInit]> = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      calls.push([url, init])
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch

    const picked = file('invoice.png', 'image/png', 2048)
    await uploadInvoiceObject(ticket(2048), picked)

    expect(calls).toHaveLength(1)
    expect(calls[0][0]).toContain('/local-private-storage/invoices/')
    expect(calls[0][1]).toMatchObject({
      method: 'PUT',
      headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
      credentials: 'omit',
      body: picked,
    })
  })

  test('accepts an idempotent retry and rejects changed or refused files', async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 412 })) as unknown as typeof fetch
    await expect(uploadInvoiceObject(ticket(2048), file('invoice.png', 'image/png', 2048))).resolves.toBeUndefined()

    let called = false
    globalThis.fetch = mock(async () => {
      called = true
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
    await expect(uploadInvoiceObject(ticket(2048), file('invoice.png', 'image/png', 4096))).rejects.toThrow(
      'Файл изменился',
    )
    expect(called).toBe(false)

    globalThis.fetch = mock(async () => new Response(null, { status: 403 })) as unknown as typeof fetch
    await expect(uploadInvoiceObject(ticket(2048), file('invoice.png', 'image/png', 2048))).rejects.toThrow(
      'Хранилище отклонило',
    )
  })
})
