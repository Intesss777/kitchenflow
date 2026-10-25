import {
  Analytics02Icon,
  ArrowRight01Icon,
  Calendar02Icon,
  Calendar03Icon,
  Invoice01Icon,
  MoneyReceiveFlow02Icon,
  PackageOpenIcon,
  Settings01Icon,
  Store01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon, type IconSvgElement } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import type { OperationsDashboardResponse } from '@kitchenflow/contracts'
import { ru } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  XAxis,
  YAxis,
} from 'recharts'

import { SectionCards, type SectionMetric } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useOperationsDashboardQuery } from '@/features/operations'
import {
  dashboardDateRange,
  dashboardMetricIds,
  defaultDashboardMetrics,
  demoRevenueAnalytics,
  foodCostPercent,
  parseDashboardMetrics,
  revenueChartData,
  todayDate,
  type DashboardMetricId,
  type DashboardPeriod,
} from './dashboard-model'

const dashboardMetricStorageKey = 'kitchenflow.dashboard.metrics'
const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})
const compactCurrency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  notation: 'compact',
  maximumFractionDigits: 1,
})
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const monthDate = new Intl.DateTimeFormat('ru-RU', { month: 'short' })
const operationDate = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })

const revenueChartConfig = {
  revenue: { label: 'Выручка за день', color: 'var(--primary)' },
  average: { label: 'Скользящее среднее', color: 'var(--chart-1)' },
} satisfies ChartConfig

const cashFlowChartConfig = {
  purchases: { label: 'Закупки', color: 'var(--chart-3)' },
  payments: { label: 'Оплаты', color: 'var(--chart-4)' },
} satisfies ChartConfig

type DashboardAnalytics = OperationsDashboardResponse['analytics'] & { isDemo: boolean }

export function AdminMetrics() {
  const [period, setPeriod] = useState<DashboardPeriod>('month')
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [visibleMetrics, setVisibleMetrics] = useState<DashboardMetricId[]>(() =>
    parseDashboardMetrics(globalThis.localStorage?.getItem(dashboardMetricStorageKey) ?? null)
      ?? [...defaultDashboardMetrics],
  )
  const range = useMemo(
    () => dashboardDateRange(period, selectedDate),
    [period, selectedDate],
  )
  const query = useOperationsDashboardQuery(range)

  if (query.isPending) return <DashboardSkeleton />
  if (query.isError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Не удалось загрузить дашборд</AlertTitle>
        <AlertDescription>{query.error.message}</AlertDescription>
        <AlertAction>
          <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
            Повторить
          </Button>
        </AlertAction>
      </Alert>
    )
  }

  const data = query.data
  const analytics: DashboardAnalytics = import.meta.env.DEV
    ? demoRevenueAnalytics(data.analytics)
    : { ...data.analytics, isDemo: false }
  const metrics = metricCards(data, analytics)
  const selectedCards = visibleMetrics
    .map((metricId) => metrics[metricId])
    .filter((metric): metric is SectionMetric => metric !== undefined)

  const updateVisibleMetrics = (metricId: DashboardMetricId, checked: boolean) => {
    const next = checked
      ? [...visibleMetrics, metricId].slice(0, 6)
      : visibleMetrics.filter((item) => item !== metricId)
    if (next.length === 0) return
    setVisibleMetrics(next)
    globalThis.localStorage?.setItem(dashboardMetricStorageKey, JSON.stringify(next))
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Typography as="h1" variant="h4">{data.workspace.organizationName}</Typography>
          <Badge variant="outline">{data.workspace.branchName}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodControl onChange={setPeriod} period={period} />
          <DateControl onChange={setSelectedDate} value={selectedDate} />
          <DashboardSettings
            metrics={metrics}
            onChange={updateVisibleMetrics}
            visibleMetrics={visibleMetrics}
          />
        </div>
      </section>

      <SectionCards className="lg:grid-cols-3 xl:grid-cols-4" items={selectedCards} />

      <RevenueChart analytics={analytics} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <CashFlowChart analytics={analytics} />
        <RecentOperations entries={data.recentEntries} />
      </div>

      <Reports />
    </div>
  )
}

function PeriodControl({
  onChange,
  period,
}: {
  onChange: (period: DashboardPeriod) => void
  period: DashboardPeriod
}) {
  const periods: ReadonlyArray<{ id: DashboardPeriod; label: string }> = [
    { id: 'day', label: 'День' },
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'year', label: 'Год' },
  ]
  return (
    <div aria-label="Период аналитики" className="flex rounded-lg border bg-card p-1" role="group">
      {periods.map((item) => (
        <Button
          aria-pressed={period === item.id}
          key={item.id}
          onClick={() => onChange(item.id)}
          size="sm"
          type="button"
          variant={period === item.id ? 'secondary' : 'ghost'}
        >
          {item.label}
        </Button>
      ))}
    </div>
  )
}

function DateControl({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const selected = new Date(`${value}T12:00:00`)
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="Выбрать дату аналитики" type="button" variant="outline">
          <HugeiconsIcon icon={Calendar03Icon} strokeWidth={2} />
          {shortDate.format(selected)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <Calendar
          captionLayout="dropdown"
          locale={ru}
          mode="single"
          onSelect={(date) => date && onChange(localDate(date))}
          selected={selected}
        />
      </PopoverContent>
    </Popover>
  )
}

function DashboardSettings({
  metrics,
  onChange,
  visibleMetrics,
}: {
  metrics: Record<DashboardMetricId, SectionMetric>
  onChange: (metricId: DashboardMetricId, checked: boolean) => void
  visibleMetrics: ReadonlyArray<DashboardMetricId>
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button data-testid="dashboard-settings-trigger" type="button" variant="outline">
          <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} />
          Настроить
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-dvh flex-col gap-0 overflow-hidden p-0" data-testid="dashboard-settings-dialog">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-4">
          <DialogTitle>Показатели на дашборде</DialogTitle>
          <DialogDescription>
            Выберите от одного до шести показателей. Настройка сохранится на этом устройстве.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 flex-1 gap-2 overflow-y-auto px-6 py-1">
          {dashboardMetricIds.map((metricId) => {
            const checked = visibleMetrics.includes(metricId)
            const disabled = (!checked && visibleMetrics.length >= 6)
              || (checked && visibleMetrics.length === 1)
            return (
              <label
                className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border p-3 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                key={metricId}
              >
                <span className="grid gap-0.5">
                  <Typography variant="bodySmMedium">{metrics[metricId].label}</Typography>
                  <Typography tone="muted" variant="caption">{metrics[metricId].description}</Typography>
                </span>
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => onChange(metricId, value === true)}
                />
              </label>
            )
          })}
        </div>
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <DialogClose asChild><Button type="button">Готово</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RevenueChart({ analytics }: { analytics: DashboardAnalytics }) {
  const data = revenueChartData(analytics.series)
  const hasRevenue = data.some((item) => item.revenue > 0)

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 border-b">
        <div className="grid gap-1">
          <div className="flex items-center gap-2">
            <CardTitle>Выручка</CardTitle>
            {analytics.isDemo && <Badge variant="secondary">Демо-данные</Badge>}
          </div>
          <Typography tone="muted" variant="bodySm">
            Фактическая динамика и скользящее среднее · {rangeLabel(analytics.range)}
          </Typography>
        </div>
        <div className="text-right">
          <Typography className="tabular-nums" variant="h4">
            {formatMoney(analytics.totals.revenue)}
          </Typography>
          <Typography tone="muted" variant="caption">
            валовая прибыль {formatMoney(analytics.totals.grossProfit)}
          </Typography>
        </div>
      </CardHeader>
      <CardContent>
        {hasRevenue ? (
          <ChartContainer className="h-72 w-full" config={revenueChartConfig}>
            <AreaChart accessibilityLayer data={data} margin={{ left: 4, right: 12, top: 16 }}>
              <defs>
                <linearGradient id="revenue-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-revenue)" stopOpacity={0.38} />
                  <stop offset="82%" stopColor="var(--color-revenue)" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} />
              <XAxis axisLine={false} dataKey="date" tickFormatter={(value) => chartDate(value, analytics.range.granularity)} tickLine={false} />
              <YAxis axisLine={false} tickFormatter={(value) => compactCurrency.format(Number(value))} tickLine={false} width={64} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                activeDot={{ r: 4 }}
                dataKey="revenue"
                dot={{ fill: 'var(--color-revenue)', r: 2, strokeWidth: 0 }}
                fill="url(#revenue-fill)"
                stroke="var(--color-revenue)"
                strokeWidth={2.5}
                type="monotone"
              />
              <Line
                dataKey="average"
                dot={false}
                stroke="var(--color-average)"
                strokeDasharray="6 5"
                strokeWidth={2}
                type="monotone"
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="grid min-h-72 place-content-center gap-2 text-center">
            <Typography variant="bodySmMedium">За этот период нет подтверждённых смен</Typography>
            <Typography tone="muted" variant="bodySm">
              Выручка появится после подтверждения первой смены.
            </Typography>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CashFlowChart({ analytics }: { analytics: DashboardAnalytics }) {
  const data = analytics.series.map((item) => ({
    date: item.date,
    purchases: Number(item.purchases),
    payments: Number(item.payments),
  }))
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Закупки и оплаты</CardTitle>
        <Typography tone="muted" variant="bodySm">Движение денег за выбранный период</Typography>
      </CardHeader>
      <CardContent>
        <ChartContainer className="h-64 w-full" config={cashFlowChartConfig}>
          <BarChart accessibilityLayer data={data} margin={{ left: 4, right: 8, top: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="date" tickFormatter={(value) => chartDate(value, analytics.range.granularity)} tickLine={false} />
            <YAxis axisLine={false} tickFormatter={(value) => compactCurrency.format(Number(value))} tickLine={false} width={60} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="purchases" fill="var(--color-purchases)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="payments" fill="var(--color-payments)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function metricCards(
  data: OperationsDashboardResponse,
  analytics: DashboardAnalytics,
): Record<DashboardMetricId, SectionMetric> {
  const totals = analytics.totals
  const purchases = Number(totals.purchases)
  const payments = Number(totals.payments)
  const foodCostRate = foodCostPercent(totals.revenue, totals.foodCost)
  return {
    revenue: { label: 'Выручка', value: formatMoney(totals.revenue), icon: MoneyReceiveFlow02Icon, description: 'Продажи по подтверждённым сменам.' },
    foodCostPercent: { label: 'Food Cost', value: foodCostRate === null ? '—' : `${foodCostRate.toLocaleString('ru-RU')}%`, icon: PackageOpenIcon, description: 'Доля себестоимости продуктов в выручке.' },
    grossMarginPercent: { label: 'Валовая маржа', value: totals.grossMarginPercent === null ? '—' : `${totals.grossMarginPercent.toLocaleString('ru-RU')}%`, icon: Analytics02Icon, description: 'Доля валовой прибыли в выручке.' },
    grossProfit: { label: 'Валовая прибыль', value: formatMoney(totals.grossProfit), icon: Analytics02Icon, description: 'Выручка за вычетом себестоимости продуктов.' },
    purchases: { label: 'Закупки', value: formatMoney(totals.purchases), icon: Invoice01Icon, description: 'Закупки за выбранный период.' },
    payments: { label: 'Оплаты', value: formatMoney(totals.payments), icon: MoneyReceiveFlow02Icon, description: 'Оплаты поставщикам за выбранный период.' },
    paymentShare: { label: 'Доля оплат', value: purchases > 0 ? `${Math.round((payments / purchases) * 100).toLocaleString('ru-RU')}%` : '—', icon: Analytics02Icon, description: 'Отношение оплат к закупкам.' },
    supplierDebt: { label: 'Долг поставщикам', value: formatMoney(data.metrics.supplierDebt), icon: Store01Icon, description: 'Текущая задолженность по поставщикам.' },
    confirmedShifts: { label: 'Закрыто смен', value: totals.confirmedShifts, icon: Calendar02Icon, description: 'Подтверждённые смены за период.' },
    dishesSold: { label: 'Продано блюд', value: totals.dishesSold, icon: PackageOpenIcon, description: 'Количество блюд в подтверждённых сменах.' },
    activeSuppliers: { label: 'Поставщиков', value: data.metrics.activeSuppliers, icon: Store01Icon, description: 'Активные поставщики организации.' },
    overdueSuppliers: { label: 'Просрочено', value: data.metrics.overdueSuppliers, icon: Store01Icon, description: 'Поставщики с просроченной оплатой.' },
  }
}

function RecentOperations({ entries }: { entries: OperationsDashboardResponse['recentEntries'] }) {
  return (
    <Card>
      <CardHeader className="border-b"><CardTitle>Последние операции</CardTitle></CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <Typography tone="muted" variant="bodySm">Операций пока нет.</Typography>
        ) : (
          <div className="grid divide-y">
            {entries.slice(0, 5).map((entry) => (
              <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0" key={entry.id}>
                <div className="min-w-0">
                  <Typography truncate variant="bodySmMedium">{entry.supplierName}</Typography>
                  <Typography tone="muted" variant="caption">
                    {entry.type === 'payment' ? 'Оплата' : 'Закупка'} · {operationDate.format(new Date(entry.occurredAt))}
                  </Typography>
                </div>
                <Typography className="shrink-0 tabular-nums" variant="bodySmMedium">{formatMoney(entry.amount)}</Typography>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const reports: ReadonlyArray<{ description: string; href: '/admin/inventory' | '/admin/invoices' | '/admin/shifts'; icon: IconSvgElement; title: string }> = [
  { description: 'Остатки, дефицит и движение продуктов.', href: '/admin/inventory', icon: PackageOpenIcon, title: 'Складской отчёт' },
  { description: 'История поставок и принятых накладных.', href: '/admin/invoices', icon: Invoice01Icon, title: 'Отчёт по закупкам' },
  { description: 'Продажи и списания по закрытым сменам.', href: '/admin/shifts', icon: Calendar02Icon, title: 'Отчёт по сменам' },
]

function Reports() {
  return (
    <section aria-labelledby="reports-title" className="grid gap-3">
      <Typography as="h2" id="reports-title" variant="h4">Отчёты</Typography>
      <div className="grid gap-3 md:grid-cols-3">
        {reports.map((report) => (
          <Link className="group flex min-h-28 items-start gap-4 rounded-xl border bg-card p-5 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50" key={report.title} to={report.href}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><HugeiconsIcon aria-hidden icon={report.icon} size={20} strokeWidth={2} /></span>
            <span className="grid min-w-0 flex-1 gap-1">
              <Typography as="span" variant="bodySmMedium">{report.title}</Typography>
              <Typography as="span" tone="muted" variant="caption">{report.description}</Typography>
            </span>
            <HugeiconsIcon aria-hidden className="mt-1 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" icon={ArrowRight01Icon} size={18} strokeWidth={2} />
          </Link>
        ))}
      </div>
    </section>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-label="Загрузка дашборда" className="grid gap-6" role="status">
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton className="h-20 rounded-xl" key={index} />)}</div>
      <Skeleton className="h-96 rounded-xl" />
      <div className="grid gap-6 xl:grid-cols-2"><Skeleton className="h-80 rounded-xl" /><Skeleton className="h-80 rounded-xl" /></div>
    </div>
  )
}

function formatMoney(value: string) {
  return currency.format(Number(value))
}

function chartDate(value: string, granularity: 'day' | 'month') {
  const date = new Date(`${value}T12:00:00`)
  return granularity === 'month' ? monthDate.format(date) : shortDate.format(date)
}

function rangeLabel(range: OperationsDashboardResponse['analytics']['range']) {
  if (range.from === range.to) return shortDate.format(new Date(`${range.from}T12:00:00`))
  return `${shortDate.format(new Date(`${range.from}T12:00:00`))} — ${shortDate.format(new Date(`${range.to}T12:00:00`))}`
}

function localDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
