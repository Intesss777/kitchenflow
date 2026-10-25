import { describe, expect, test } from 'bun:test'

import { dishCardsOverviewResponseSchema, saveDishCardRequestSchema } from './dishes'

const firstProduct = '0199c000-0000-7000-8000-000000000030'

describe('dish card contracts', () => {
  test('keeps a card intentionally small and rejects duplicate ingredients', () => {
    const input = {
      name: 'Филадельфия',
      category: 'Роллы',
      sellingPrice: '890.00',
      ingredients: [{ productId: firstProduct, quantity: '0.120' }],
    }
    expect(saveDishCardRequestSchema.parse(input)).toEqual(input)
    expect(() => saveDishCardRequestSchema.parse({
      ...input,
      ingredients: [...input.ingredients, ...input.ingredients],
    })).toThrow()
  })

  test('allows the API to redact every financial value for a chef', () => {
    expect(dishCardsOverviewResponseSchema.parse({
      workspace: { organizationName: 'KitchenFlow', branchName: 'Основной', role: 'chef' },
      metrics: { activeDishes: 1, ingredientLinks: 1, averageFoodCostPercent: null },
      products: [{ id: firstProduct, name: 'Лосось', unit: 'kilogram' }],
      dishes: [{
        id: '0199c000-0000-7000-8000-000000000060',
        name: 'Филадельфия',
        category: 'Роллы',
        photoUrl: '/dishes/philadelphia.svg',
        sellingPrice: null,
        costPrice: null,
        marginAmount: null,
        ingredients: [{
          id: '0199c000-0000-7000-8000-000000000061',
          productId: firstProduct,
          name: 'Лосось',
          unit: 'kilogram',
          quantity: '0.120',
          costAmount: null,
        }],
        updatedAt: '2026-10-11T12:00:00.000Z',
      }],
    }).dishes[0]?.sellingPrice).toBeNull()
  })
})
