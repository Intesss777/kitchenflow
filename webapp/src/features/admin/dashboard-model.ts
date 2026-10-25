import type { OperationsDashboardResponse } from '@kitchenflow/contracts'

export const dashboardPeriods = ['day', 'week', 'month', 'year'] as const
export type DashboardPeriod = (typeof dashboardPeriods)[number]

export const dashboardMetricIds = [
  'revenue',
  'foodCostPercent',
  'grossMarginPercent',
  'grossProfit',
  'purchases',
  'payments',
  'paymentShare',
  'supplierDebt',
  'confirmedShifts',
  'dishesSold',
  'activeSuppliers',
  'overdueSuppliers',
] as const

export type DashboardMetricId = (typeof dashboardMetricIds)[number]

export const defaultDashboardMetrics: ReadonlyArray<DashboardMetricId> = [
  'revenue',
  'grossMarginPercent',
  'purchases',
  'confirmedShifts',
]

const metricIds = new Set<string>(dashboardMetricIds)

export function foodCostPercent(revenue: string, foodCost: string): number | null {
  const revenueValue = Number(revenue)
  const foodCostValue = Number(foodCost)
  if (!Number.isFinite(revenueValue) || !Number.isFinite(foodCostValue) || revenueValue <= 0) {
    return null
  }
  return Math.round((foodCostValue / revenueValue) * 1_000) / 10
}

export function parseDashboardMetrics(value: string | null): DashboardMetricId[] | null {
  if (!value) return null
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return null
    const metrics = [...new Set(parsed.filter(
      (item): item is DashboardMetricId => typeof item === 'string' && metricIds.has(item),
    ))]
    return metrics.length > 0 ? metrics.slice(0, 6) : null
  } catch {
    return null
  }
}

export function dashboardDateRange(
  period: DashboardPeriod,
  selectedDate: string,
): { from: string; to: string } {
  const selected = parseDate(selectedDate)
  if (period === 'day') return { from: selectedDate, to: selectedDate }
  if (period === 'week') {
    return { from: formatDate(addDays(selected, -6)), to: selectedDate }
  }
  if (period === 'month') {
    const from = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1))
    const to = new Date(Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth() + 1, 0))
    return { from: formatDate(from), to: formatDate(to) }
  }
  return {
    from: `${selected.getUTCFullYear()}-01-01`,
    to: `${selected.getUTCFullYear()}-12-31`,
  }
}

export function todayDate() {
  return formatDate(new Date())
}

export function demoRevenueAnalytics(
  analytics: OperationsDashboardResponse['analytics'],
): OperationsDashboardResponse['analytics'] & { isDemo: boolean } {
  if (Number(analytics.totals.revenue) > 0 || analytics.series.length === 0) {
    return { ...analytics, isDemo: false }
  }

  const series = analytics.series.map((item, index) => {
    const revenue = demoRevenue(item.date, index, analytics.range.granularity)
    const foodCost = revenue * (0.29 + stableFraction(`${item.date}:food-cost`) * 0.07)
    return {
      ...item,
      revenue: money(revenue),
      foodCost: money(foodCost),
    }
  })
  const revenue = series.reduce((total, item) => total + Number(item.revenue), 0)
  const foodCost = series.reduce((total, item) => total + Number(item.foodCost), 0)
  const grossProfit = revenue - foodCost

  return {
    ...analytics,
    isDemo: true,
    series,
    totals: {
      ...analytics.totals,
      revenue: money(revenue),
      foodCost: money(foodCost),
      grossProfit: money(grossProfit),
      grossMarginPercent: Math.round((grossProfit / revenue) * 1_000) / 10,
      confirmedShifts: Math.max(analytics.totals.confirmedShifts, series.length),
      dishesSold: Math.max(analytics.totals.dishesSold, Math.round(revenue / 920)),
    },
  }
}

export function revenueChartData(
  series: OperationsDashboardResponse['analytics']['series'],
) {
  const windowSize = series.length >= 14 ? 7 : series.length >= 5 ? 3 : 1
  return series.map((item, index) => {
    const start = Math.max(0, index - windowSize + 1)
    const window = series.slice(start, index + 1)
    const average = window.reduce((total, point) => total + Number(point.revenue), 0)
      / window.length
    return {
      date: item.date,
      revenue: Number(item.revenue),
      average: Math.round(average * 100) / 100,
    }
  })
}

function demoRevenue(date: string, index: number, granularity: 'day' | 'month') {
  if (granularity === 'month') {
    const month = Number(date.slice(5, 7)) - 1
    const seasonalDemand = [0.78, 0.8, 0.87, 0.92, 0.96, 1.02, 1.08, 1.04, 0.98, 1.01, 1.1, 1.24]
    return 1_780_000
      * seasonalDemand[month]!
      * (1 + index * 0.012)
      * (0.96 + stableFraction(date) * 0.08)
  }

  const day = parseDate(date).getUTCDay()
  const weeklyDemand = [1.08, 0.72, 0.76, 0.82, 0.94, 1.18, 1.32]
  const eventFactor = (index + 1) % 11 === 0 ? 1.12 : (index + 1) % 17 === 0 ? 0.91 : 1
  return 62_000
    * weeklyDemand[day]!
    * (1 + index * 0.004)
    * (0.94 + stableFraction(date) * 0.12)
    * eventFactor
}

function stableFraction(value: string) {
  let hash = 2_166_136_261
  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16_777_619)
  }
  hash ^= hash >>> 16
  hash = Math.imul(hash, 2_246_822_507)
  hash ^= hash >>> 13
  hash = Math.imul(hash, 3_266_489_909)
  hash ^= hash >>> 16
  return (hash >>> 0) / 4_294_967_295
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) throw new Error('Invalid dashboard date')
  return date
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000)
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function money(value: number) {
  return value.toFixed(2)
}
