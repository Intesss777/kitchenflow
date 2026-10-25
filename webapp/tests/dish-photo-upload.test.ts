import { afterEach, describe, expect, mock, test } from 'bun:test'
import { DISH_PHOTO_MAX_BYTES, DISH_PHOTO_MIN_BYTES, type UploadTicket } from '@kitchenflow/contracts'

import {
  describeDishPhoto,
  DishPhotoUploadError,
  uploadDishPhotoObject,
} from '@/features/dishes'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch })

function file(name: string, type: string, size: number) {
  return new File([new Uint8Array(size)], name, { type })
}

function ticket(contentLength: number): UploadTicket {
  return {
    uploadId: '019c0000-0000-7000-8000-000000000201',
    method: 'PUT',
    url: 'http://127.0.0.1:24331/local-private-storage/dish-photos/abc?x-sig=1',
    headers: { 'Content-Type': 'image/jpeg', 'If-None-Match': '*' },
    contentLength,
    expiresAt: '2026-10-11T22:15:00.000Z',
  }
}

describe('describeDishPhoto', () => {
  test('accepts phone camera formats and extension fallback', () => {
    expect(describeDishPhoto(file('dish.jpeg', 'image/jpeg', 2048))).toEqual({ contentType: 'image/jpeg', byteSize: 2048 })
    expect(describeDishPhoto(file('dish.HEIC', '', 2048))).toEqual({ contentType: 'image/heic', byteSize: 2048 })
  })

  test('rejects unsupported, damaged, and oversized files', () => {
    expect(() => describeDishPhoto(file('dish.svg', 'image/svg+xml', 2048))).toThrow(DishPhotoUploadError)
    expect(() => describeDishPhoto(file('dish.png', 'image/png', DISH_PHOTO_MIN_BYTES - 1))).toThrow('повреждён')
    expect(() => describeDishPhoto(file('dish.png', 'image/png', DISH_PHOTO_MAX_BYTES + 1))).toThrow('меньше 10 МБ')
  })
})

describe('uploadDishPhotoObject', () => {
  test('uses the private ticket without browser credentials', async () => {
    const calls: Array<[string, RequestInit]> = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      calls.push([url, init])
      return new Response(null, { status: 200 })
    }) as unknown as typeof fetch
    const picked = file('dish.jpg', 'image/jpeg', 2048)
    await uploadDishPhotoObject(ticket(2048), picked)
    expect(calls[0]?.[1]).toMatchObject({ method: 'PUT', credentials: 'omit', body: picked })
  })

  test('accepts safe retry and rejects size changes before transfer', async () => {
    globalThis.fetch = mock(async () => new Response(null, { status: 412 })) as unknown as typeof fetch
    await expect(uploadDishPhotoObject(ticket(2048), file('dish.jpg', 'image/jpeg', 2048))).resolves.toBeUndefined()
    let called = false
    globalThis.fetch = mock(async () => { called = true; return new Response(null, { status: 200 }) }) as unknown as typeof fetch
    await expect(uploadDishPhotoObject(ticket(2048), file('dish.jpg', 'image/jpeg', 4096))).rejects.toThrow('Файл изменился')
    expect(called).toBe(false)
  })
})
