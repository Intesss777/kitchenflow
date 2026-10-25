import { describe, expect, test } from 'bun:test'

import {
  demoRevenueAnalytics,
  dashboardDateRange,
  foodCostPercent,
  parseDashboardMetrics,
  revenueChartData,
} from '../src/features/admin/dashboard-model'

describe('dashboard model', () => {
  test('builds day, week, month and year ranges around the selected date', () => {
    expect(dashboardDateRange('day', '2026-10-14')).toEqual({
      from: '2026-10-14',
      to: '2026-10-14',
    })
    expect(dashboardDateRange('week', '2026-10-14')).toEqual({
      from: '2026-10-08',
      to: '2026-10-14',
    })
    expect(dashboardDateRange('month', '2026-10-14')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    })
    expect(dashboardDateRange('year', '2026-10-14')).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    })
  })

  test('keeps only unique supported personalized cards', () => {
    expect(parseDashboardMetrics('["revenue","foodCostPercent","payments","revenue","unknown"]')).toEqual([
      'revenue',
      'foodCostPercent',
      'payments',
    ])
    expect(parseDashboardMetrics('broken')).toBeNull()
    expect(parseDashboardMetrics('[]')).toBeNull()
  })

  test('calculates Food Cost as a share of revenue', () => {
    expect(foodCostPercent('2450.00', '735.00')).toBe(30)
    expect(foodCostPercent('0.00', '0.00')).toBeNull()
  })

  test('fills an empty local revenue series with a restaurant weekly rhythm', () => {
    const analytics = demoRevenueAnalytics({
      range: { from: '2026-10-01', to: '2026-10-28', granularity: 'day' },
      totals: {
        revenue: '0.00',
        foodCost: '0.00',
        grossProfit: '0.00',
        grossMarginPercent: null,
        purchases: '1000.00',
        payments: '500.00',
        confirmedShifts: 0,
        dishesSold: 0,
      },
      series: Array.from({ length: 28 }, (_, index) => ({
        date: `2026-10-${String(index + 1).padStart(2, '0')}`,
        revenue: '0.00',
        foodCost: '0.00',
        purchases: '200.00',
        payments: '100.00',
      })),
    })

    const revenue = analytics.series.map((item) => Number(item.revenue))
    const earlyWeek = analytics.series.filter((item) => {
      const day = new Date(`${item.date}T00:00:00.000Z`).getUTCDay()
      return day === 1 || day === 2
    })
    const weekend = analytics.series.filter((item) => {
      const day = new Date(`${item.date}T00:00:00.000Z`).getUTCDay()
      return day === 5 || day === 6
    })
    const average = (items: typeof analytics.series) =>
      items.reduce((total, item) => total + Number(item.revenue), 0) / items.length

    expect(analytics.isDemo).toBe(true)
    expect(revenue.some((value, index) => index > 0 && value > revenue[index - 1]!)).toBe(true)
    expect(revenue.some((value, index) => index > 0 && value < revenue[index - 1]!)).toBe(true)
    expect(average(weekend)).toBeGreaterThan(average(earlyWeek))
    expect(Number(analytics.totals.revenue)).toBeGreaterThan(0)
    expect(analytics.totals.purchases).toBe('1000.00')
  })

  test('builds a rolling average that follows daily revenue without duplicating it', () => {
    const data = revenueChartData([
      { date: '2026-10-01', revenue: '100.00', foodCost: '30.00', purchases: '0.00', payments: '0.00' },
      { date: '2026-10-02', revenue: '200.00', foodCost: '60.00', purchases: '0.00', payments: '0.00' },
      { date: '2026-10-03', revenue: '300.00', foodCost: '90.00', purchases: '0.00', payments: '0.00' },
      { date: '2026-10-04', revenue: '600.00', foodCost: '180.00', purchases: '0.00', payments: '0.00' },
      { date: '2026-10-05', revenue: '400.00', foodCost: '120.00', purchases: '0.00', payments: '0.00' },
    ])

    expect(data.map((item) => item.average)).toEqual([100, 150, 200, 366.67, 433.33])
    expect(data.map((item) => item.revenue)).toEqual([100, 200, 300, 600, 400])
  })
})
