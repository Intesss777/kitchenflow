import { describe, expect, test } from 'bun:test'

import { moneyInputStep, quantityInputStep } from '@/platform/intl/quantity'

describe('quantity input step', () => {
  test('uses human-scale increments instead of thousandths', () => {
    expect(quantityInputStep('kilogram')).toBe('0.1')
    expect(quantityInputStep('liter')).toBe('0.1')
    expect(quantityInputStep('gram')).toBe('1')
    expect(quantityInputStep('milliliter')).toBe('1')
    expect(quantityInputStep('piece')).toBe('1')
  })

  test('changes invoice prices by whole rubles while keeping manual decimals available', () => {
    expect(moneyInputStep()).toBe('1')
  })
})
