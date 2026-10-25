import { expect, test } from 'bun:test'

import { calendarCells, shiftMonth } from '@/features/staff'

test('staff calendar starts on Monday and covers the complete month', () => {
  const october = calendarCells('2026-10')
  expect(october[3]).toEqual({ day: 1, date: '2026-10-01' })
  expect(october.filter(Boolean)).toHaveLength(31)
  expect(october.length % 7).toBe(0)
})

test('month navigation crosses year boundaries', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  expect(shiftMonth('2026-01', -1)).toBe('2025-12')
})
