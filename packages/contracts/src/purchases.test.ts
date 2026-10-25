import { describe, expect, test } from 'bun:test'

import {
  preparePurchaseMessageRequestSchema,
  preparePurchaseMessageResponseSchema,
  savePurchaseDraftRequestSchema,
} from './purchases'

const productId = '0199c000-0000-7000-8000-000000000030'
describe('purchase draft contracts', () => {
  test('accepts one shared draft and rejects duplicate or zero quantities', () => {
    const input = {
      note: 'Доставить до 10:00',
      items: [{ productId, requestedQuantity: '2.500' }],
    }
    expect(savePurchaseDraftRequestSchema.parse(input)).toEqual(input)
    expect(() => savePurchaseDraftRequestSchema.parse({
      ...input,
      items: [...input.items, ...input.items],
    })).toThrow()
    expect(() => savePurchaseDraftRequestSchema.parse({
      ...input,
      items: [{ productId, requestedQuantity: '0.000' }],
    })).toThrow()
  })

  test('prepares a generic WhatsApp share link for the buyer', () => {
    expect(preparePurchaseMessageResponseSchema.parse({
      message: 'Закупка — Основной ресторан',
      whatsappUrl: 'https://wa.me/?text=test',
    }).whatsappUrl).toStartWith('https://wa.me/')
  })

  test('prepares messages without prices by default and accepts an explicit price option', () => {
    const input = {
      note: null,
      items: [{ productId, requestedQuantity: '2.500' }],
    }
    expect(preparePurchaseMessageRequestSchema.parse(input).includePrices).toBe(false)
    expect(preparePurchaseMessageRequestSchema.parse({
      ...input,
      includePrices: true,
    }).includePrices).toBe(true)
  })
})
