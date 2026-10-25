import {
  CameraAdd02Icon,
  CheckmarkCircle02Icon,
  Invoice01Icon,
  ScanTextIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  updatePurchaseInvoiceRequestSchema,
  type InventoryUnit,
  type PurchaseInvoice,
  type PurchaseInvoiceListQuery,
  type PurchaseInvoiceListResponse,
  type UpdatePurchaseInvoiceRequest,
} from '@kitchenflow/contracts'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'

import { SectionCards } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { moneyInputStep, quantityInputStep } from '@/platform/intl/quantity'
import {
  useConfirmInvoiceMutation,
  usePurchaseInvoiceQuery,
  useUpdateInvoiceMutation,
  useUploadInvoiceMutation,
} from './queries'

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})
const shortDate = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: 'short' })
const units: Record<InventoryUnit, string> = {
  kilogram: 'кг',
  gram: 'г',
  liter: 'л',
  milliliter: 'мл',
  piece: 'шт.',
}

export function InvoiceWorkspace({
  data,
  filters,
  onFiltersChange,
}: {
  data: PurchaseInvoiceListResponse
  filters: PurchaseInvoiceListQuery
  onFiltersChange: (query: PurchaseInvoiceListQuery) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    data.invoices.find((invoice) => invoice.status === 'review')?.id ?? data.invoices[0]?.id ?? null,
  )
  const fileInput = useRef<HTMLInputElement>(null)
  const upload = useUploadInvoiceMutation()
  const resolvedSelectedId = selectedId && data.invoices.some((invoice) => invoice.id === selectedId)
    ? selectedId
    : data.invoices.find((invoice) => invoice.status === 'review')?.id ?? data.invoices[0]?.id ?? null

  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    upload.mutate(file, {
      onSuccess: (response) => setSelectedId(response.invoice.id),
    })
  }

  return (
    <div className="grid gap-6">
      <SectionCards
        items={[
          {
            label: 'Ждут проверки',
            value: data.metrics.needsReview,
            description: 'Распознаны, но ещё не влияют на склад.',
          },
          {
            label: 'Подтверждено за месяц',
            value: data.metrics.confirmedThisMonth,
            description: 'Уже добавлены в остатки и задолженность.',
          },
          {
            label: 'Поставки за месяц',
            value: currency.format(Number(data.metrics.amountThisMonth)),
            description: `Филиал: ${data.workspace.branchName}`,
          },
        ]}
      />

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card">
        <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
              <HugeiconsIcon icon={CameraAdd02Icon} size={24} />
            </span>
            <div>
              <Typography as="h2" variant="h5">Сфотографируйте накладную</Typography>
            </div>
          </div>
          <Button disabled={upload.isPending} onClick={() => fileInput.current?.click()} size="lg">
            <HugeiconsIcon icon={upload.isPending ? ScanTextIcon : CameraAdd02Icon} />
            {upload.isPending ? 'Распознаём…' : 'Фото накладной'}
          </Button>
          <input
            accept="image/jpeg,image/png,image/heic,image/heif"
            aria-hidden="true"
            capture="environment"
            className="sr-only"
            data-testid="invoice-file-input"
            onChange={pickPhoto}
            ref={fileInput}
            tabIndex={-1}
            type="file"
          />
        </CardContent>
      </Card>

      {upload.isError && (
        <Alert variant="destructive">
          <AlertTitle>Накладная не загружена</AlertTitle>
          <AlertDescription>{upload.error.message}</AlertDescription>
        </Alert>
      )}

      <InvoiceArchiveFilters
        data={data}
        filters={filters}
        onChange={onFiltersChange}
      />

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <InvoiceList data={data} onSelect={setSelectedId} selectedId={resolvedSelectedId} />
        {resolvedSelectedId ? (
          <InvoiceDetail
            data={data}
            invoiceId={resolvedSelectedId}
          />
        ) : (
          <EmptyInvoice />
        )}
      </div>
      <ArchivePagination data={data} filters={filters} onChange={onFiltersChange} />
    </div>
  )
}

function InvoiceArchiveFilters({
  data,
  filters,
  onChange,
}: {
  data: PurchaseInvoiceListResponse
  filters: PurchaseInvoiceListQuery
  onChange: (query: PurchaseInvoiceListQuery) => void
}) {
  const today = localDate()
  const month = monthRange(today.slice(0, 7))
  const year = yearRange(today.slice(0, 4))
  const update = (patch: Partial<PurchaseInvoiceListQuery>) => onChange({
    ...filters,
    ...patch,
    page: 1,
  })
  const monthValue = filters.from && filters.to && filters.from.slice(0, 7) === filters.to.slice(0, 7)
    ? filters.from.slice(0, 7)
    : ''
  return (
    <Card>
      <CardHeader className="gap-1">
        <CardTitle>Архив накладных</CardTitle>
        <CardDescription>
          Найдено: {data.pagination.total}. Фотографии хранятся приватно и открываются только авторизованным сотрудникам.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => update({ from: today, to: today })} size="sm" type="button" variant={filters.from === today && filters.to === today ? 'default' : 'outline'}>Сегодня</Button>
          <Button onClick={() => update(month)} size="sm" type="button" variant={filters.from === month.from && filters.to === month.to ? 'default' : 'outline'}>Этот месяц</Button>
          <Button onClick={() => update(year)} size="sm" type="button" variant={filters.from === year.from && filters.to === year.to ? 'default' : 'outline'}>Этот год</Button>
          <Button onClick={() => update({ from: undefined, to: undefined })} size="sm" type="button" variant={!filters.from && !filters.to ? 'default' : 'outline'}>Весь архив</Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Field>
            <FieldLabel htmlFor="invoice-archive-month">Месяц</FieldLabel>
            <Input
              id="invoice-archive-month"
              onChange={(event) => {
                if (event.target.value) update(monthRange(event.target.value))
              }}
              type="month"
              value={monthValue}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="invoice-archive-search">Поиск</FieldLabel>
            <Input
              id="invoice-archive-search"
              onChange={(event) => update({ q: event.target.value || undefined })}
              placeholder="Номер или поставщик"
              value={filters.q ?? ''}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="invoice-archive-supplier">Поставщик</FieldLabel>
            <NativeSelect id="invoice-archive-supplier" onChange={(event) => update({ supplierId: event.target.value || undefined })} value={filters.supplierId ?? ''}>
              <NativeSelectOption value="">Все поставщики</NativeSelectOption>
              {data.suppliers.map((supplier) => <NativeSelectOption key={supplier.id} value={supplier.id}>{supplier.name}</NativeSelectOption>)}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="invoice-archive-status">Статус</FieldLabel>
            <NativeSelect id="invoice-archive-status" onChange={(event) => update({ status: event.target.value ? event.target.value as PurchaseInvoiceListQuery['status'] : undefined })} value={filters.status ?? ''}>
              <NativeSelectOption value="">Все статусы</NativeSelectOption>
              <NativeSelectOption value="review">На проверке</NativeSelectOption>
              <NativeSelectOption value="confirmed">Проведена</NativeSelectOption>
              <NativeSelectOption value="rejected">Отклонена</NativeSelectOption>
            </NativeSelect>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field><FieldLabel htmlFor="invoice-archive-from">С даты</FieldLabel><Input id="invoice-archive-from" onChange={(event) => {
            const from = event.target.value
            update(from ? { from, to: filters.to && filters.to >= from ? filters.to : from } : { from: undefined, to: undefined })
          }} type="date" value={filters.from ?? ''} /></Field>
          <Field><FieldLabel htmlFor="invoice-archive-to">По дату</FieldLabel><Input id="invoice-archive-to" onChange={(event) => {
            const to = event.target.value
            update(to ? { from: filters.from && filters.from <= to ? filters.from : to, to } : { from: undefined, to: undefined })
          }} type="date" value={filters.to ?? ''} /></Field>
        </div>
      </CardContent>
    </Card>
  )
}

function ArchivePagination({
  data,
  filters,
  onChange,
}: {
  data: PurchaseInvoiceListResponse
  filters: PurchaseInvoiceListQuery
  onChange: (query: PurchaseInvoiceListQuery) => void
}) {
  if (data.pagination.total <= data.pagination.pageSize) return null
  return (
    <div className="flex items-center justify-between gap-4">
      <Typography tone="muted" variant="bodySm">Страница {data.pagination.page}</Typography>
      <div className="flex gap-2">
        <Button disabled={data.pagination.page === 1} onClick={() => onChange({ ...filters, page: data.pagination.page - 1 })} size="sm" type="button" variant="outline">Назад</Button>
        <Button disabled={!data.pagination.hasNext} onClick={() => onChange({ ...filters, page: data.pagination.page + 1 })} size="sm" type="button" variant="outline">Далее</Button>
      </div>
    </div>
  )
}

function InvoiceList({
  data,
  onSelect,
  selectedId,
}: {
  data: PurchaseInvoiceListResponse
  onSelect: (invoiceId: string) => void
  selectedId: string | null
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Накладные</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {data.invoices.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <Typography tone="muted" variant="bodySm">Загрузите первую фотографию.</Typography>
          </div>
        ) : data.invoices.map((invoice) => (
          <button
            className={cn(
              'grid gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted/60',
              selectedId === invoice.id && 'border-primary/40 bg-primary/5',
            )}
            key={invoice.id}
            onClick={() => onSelect(invoice.id)}
            type="button"
          >
            <span className="flex items-start justify-between gap-3">
              <Typography as="span" truncate variant="bodySmMedium">
                {invoice.supplierName ?? 'Поставщик не определён'}
              </Typography>
              <StatusBadge status={invoice.status} />
            </span>
            <span className="flex items-center justify-between gap-3">
              <Typography as="span" tone="muted" variant="caption">
                {invoice.invoiceNumber ?? 'Без номера'}
                {invoice.invoiceDate ? ` · ${shortDate.format(new Date(`${invoice.invoiceDate}T12:00:00`))}` : ''}
              </Typography>
              {invoice.totalAmount && <Typography as="span" className="shrink-0 tabular-nums" variant="caption">{currency.format(Number(invoice.totalAmount))}</Typography>}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}

function InvoiceDetail({
  data,
  invoiceId,
}: {
  data: PurchaseInvoiceListResponse
  invoiceId: string
}) {
  const query = usePurchaseInvoiceQuery(invoiceId)
  if (query.isPending) return <Card><CardContent className="grid gap-4 p-6"><Skeleton className="h-52 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></CardContent></Card>
  if (query.isError) return <Alert variant="destructive"><AlertTitle>Не удалось открыть накладную</AlertTitle><AlertDescription>{query.error.message}</AlertDescription></Alert>
  return query.data.invoice.status === 'review' ? (
    <InvoiceReview data={data} invoice={query.data.invoice} key={query.data.invoice.id} />
  ) : (
    <ConfirmedInvoice invoice={query.data.invoice} />
  )
}

type EditableLine = {
  id: string
  productId: string | null
  detectedName: string
  unit: InventoryUnit
  quantity: string
  unitPrice: string
}

function InvoiceReview({
  data,
  invoice,
}: {
  data: PurchaseInvoiceListResponse
  invoice: PurchaseInvoice
}) {
  const update = useUpdateInvoiceMutation()
  const confirm = useConfirmInvoiceMutation()
  const [supplierId, setSupplierId] = useState(invoice.supplierId ?? data.suppliers[0]?.id ?? '')
  const [invoiceNumber, setInvoiceNumber] = useState(invoice.invoiceNumber ?? '')
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoiceDate ?? localDate())
  const [dueAt, setDueAt] = useState(invoice.dueAt ?? localDate())
  const [lines, setLines] = useState<EditableLine[]>(() => invoice.items.map((item) => ({
    id: item.id,
    productId: item.productId,
    detectedName: item.detectedName,
    unit: item.unit,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  })))
  const [validationError, setValidationError] = useState<string | null>(null)
  const total = lines.reduce(
    (sum, line) => sum + Number(line.quantity || 0) * Number(line.unitPrice || 0),
    0,
  )
  const busy = update.isPending || confirm.isPending

  const input = (): UpdatePurchaseInvoiceRequest | null => {
    const parsed = updatePurchaseInvoiceRequestSchema.safeParse({
      supplierId,
      invoiceNumber,
      invoiceDate,
      dueAt,
      items: lines.map(({ productId, detectedName, unit, quantity, unitPrice }) => ({
        productId,
        detectedName,
        unit,
        quantity: normalizeQuantity(quantity),
        unitPrice: normalizeMoney(unitPrice),
      })),
    })
    if (!parsed.success) {
      setValidationError('Проверьте поставщика, даты, продукты, количество и цены')
      return null
    }
    if (parsed.data.items.some((item) => item.productId === null)) {
      setValidationError('Сопоставьте каждую строку с продуктом на складе')
      return null
    }
    setValidationError(null)
    return parsed.data
  }

  const save = (event: FormEvent) => {
    event.preventDefault()
    const payload = input()
    if (payload) update.mutate({ invoiceId: invoice.id, input: payload })
  }
  const saveAndConfirm = async () => {
    const payload = input()
    if (!payload) return
    try {
      await update.mutateAsync({ invoiceId: invoice.id, input: payload })
      await confirm.mutateAsync(invoice.id)
    } catch {
      // Both mutations expose the actionable backend message below.
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Проверка накладной</CardTitle>
              <Badge variant="outline"><HugeiconsIcon icon={ScanTextIcon} />Демо OCR</Badge>
              <Badge variant="secondary">{Math.round((invoice.recognitionConfidence ?? 0) * 100)}%</Badge>
            </div>
          </div>
          <StatusBadge status={invoice.status} />
        </div>
      </CardHeader>
      <CardContent>
        <form className="grid gap-6" noValidate onSubmit={save}>
          <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
            <InvoiceImage url={invoice.imageUrl} />
            <FieldGroup className="gap-4">
              <Field><FieldLabel htmlFor="invoice-supplier">Поставщик</FieldLabel><NativeSelect className="w-full" id="invoice-supplier" onChange={(event) => setSupplierId(event.target.value)} value={supplierId}>{data.suppliers.map((supplier) => <NativeSelectOption key={supplier.id} value={supplier.id}>{supplier.name}</NativeSelectOption>)}</NativeSelect></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field><FieldLabel htmlFor="invoice-number">Номер</FieldLabel><Input id="invoice-number" onChange={(event) => setInvoiceNumber(event.target.value)} value={invoiceNumber} /></Field>
                <Field><FieldLabel htmlFor="invoice-date">Дата</FieldLabel><Input id="invoice-date" onChange={(event) => setInvoiceDate(event.target.value)} type="date" value={invoiceDate} /></Field>
                <Field><FieldLabel htmlFor="invoice-due">Оплатить до</FieldLabel><Input id="invoice-due" onChange={(event) => setDueAt(event.target.value)} type="date" value={dueAt} /></Field>
              </div>
            </FieldGroup>
          </div>

          <div className="grid gap-3">
            <div className="flex items-end justify-between gap-4">
              <Typography as="h3" variant="h6">Позиции</Typography>
              <Typography className="tabular-nums" variant="h6">{currency.format(total)}</Typography>
            </div>
            {lines.map((line, index) => (
              <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-[minmax(0,1fr)_120px_130px]" key={line.id}>
                <Field>
                  <FieldLabel htmlFor={`line-product-${index}`}>{line.detectedName}</FieldLabel>
                  <NativeSelect
                    className="w-full"
                    id={`line-product-${index}`}
                    onChange={(event) => {
                      const product = data.products.find((item) => item.id === event.target.value)
                      setLines((current) => current.map((item, lineIndex) => lineIndex === index
                        ? { ...item, productId: product?.id ?? null, detectedName: product?.name ?? item.detectedName, unit: product?.unit ?? item.unit }
                        : item))
                    }}
                    value={line.productId ?? ''}
                  >
                    <NativeSelectOption value="">Выберите продукт</NativeSelectOption>
                    {data.products.map((product) => <NativeSelectOption key={product.id} value={product.id}>{product.name}</NativeSelectOption>)}
                  </NativeSelect>
                </Field>
                <Field><FieldLabel htmlFor={`line-quantity-${index}`}>Количество, {units[line.unit]}</FieldLabel><Input id={`line-quantity-${index}`} min={quantityInputStep(line.unit)} onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, quantity: event.target.value } : item))} step={quantityInputStep(line.unit)} type="number" value={trimDecimal(line.quantity)} /></Field>
                <Field><FieldLabel htmlFor={`line-price-${index}`}>Цена, ₽</FieldLabel><Input id={`line-price-${index}`} min="0" onChange={(event) => setLines((current) => current.map((item, lineIndex) => lineIndex === index ? { ...item, unitPrice: event.target.value } : item))} step={moneyInputStep()} type="number" value={trimDecimal(line.unitPrice)} /></Field>
              </div>
            ))}
          </div>

          {(validationError || update.isError || confirm.isError) && <Alert variant="destructive"><AlertTitle>Накладная не сохранена</AlertTitle><AlertDescription>{validationError ?? update.error?.message ?? confirm.error?.message}</AlertDescription></Alert>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button disabled={busy} type="submit" variant="outline">{update.isPending ? 'Сохраняем…' : 'Сохранить проверку'}</Button>
            <Button disabled={busy} onClick={() => void saveAndConfirm()} type="button"><HugeiconsIcon icon={CheckmarkCircle02Icon} />{confirm.isPending ? 'Подтверждаем…' : 'Подтвердить накладную'}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

function ConfirmedInvoice({ invoice }: { invoice: PurchaseInvoice }) {
  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="flex flex-wrap items-center gap-2"><CardTitle>{invoice.supplierName}</CardTitle><StatusBadge status={invoice.status} /></div><CardDescription>{invoice.invoiceNumber} · {invoice.invoiceDate}</CardDescription></div>
        <div className="flex flex-col items-end gap-2">
          <Typography className="tabular-nums" variant="h4">{currency.format(Number(invoice.totalAmount ?? 0))}</Typography>
          {invoice.imageUrl && (
            <Button asChild size="sm" variant="outline">
              <a href={invoice.imageUrl} rel="noreferrer" target="_blank">
                <Typography as="span" variant="bodySmMedium">Открыть оригинал</Typography>
              </a>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <Alert><HugeiconsIcon icon={CheckmarkCircle02Icon} /><AlertTitle>Накладная проведена</AlertTitle><AlertDescription>Продукты добавлены на склад, сумма записана в задолженность поставщику.</AlertDescription></Alert>
        <div className="grid gap-2">
          {invoice.items.map((item) => <div className="flex items-center justify-between gap-4 rounded-xl border p-4" key={item.id}><div><Typography variant="bodySmMedium">{item.detectedName}</Typography><Typography tone="muted" variant="caption">{trimDecimal(item.quantity)} {units[item.unit]} × {currency.format(Number(item.unitPrice))}</Typography></div><Typography className="shrink-0 tabular-nums" variant="bodySmMedium">{currency.format(Number(item.lineTotal))}</Typography></div>)}
        </div>
        <Typography tone="muted" variant="caption">Подтвердил: {invoice.confirmedByName ?? 'Сотрудник'}</Typography>
      </CardContent>
    </Card>
  )
}

function InvoiceImage({ url }: { url: string | null }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="grid min-h-56 place-items-center overflow-hidden rounded-2xl border bg-muted/50">
      {url && !failed ? <img alt="Фотография накладной" className="h-full max-h-72 w-full object-cover" onError={() => setFailed(true)} src={url} /> : <div className="p-6 text-center"><HugeiconsIcon className="mx-auto text-muted-foreground" icon={Invoice01Icon} size={36} /><Typography className="mt-3" tone="muted" variant="bodySm">Фотография хранится приватно</Typography></div>}
    </div>
  )
}

function EmptyInvoice() {
  return <Card><CardContent className="grid min-h-80 place-items-center p-8 text-center"><div><HugeiconsIcon className="mx-auto text-muted-foreground" icon={Invoice01Icon} size={40} /><Typography as="h2" className="mt-4" variant="h5">Накладных пока нет</Typography><Typography className="mt-2" tone="muted" variant="bodySm">Сфотографируйте документ — черновик появится здесь.</Typography></div></CardContent></Card>
}

function StatusBadge({ status }: { status: PurchaseInvoice['status'] }) {
  if (status === 'confirmed') return <Badge variant="outline">Проведена</Badge>
  if (status === 'review') return <Badge variant="secondary">На проверке</Badge>
  if (status === 'rejected') return <Badge variant="destructive">Отклонена</Badge>
  return <Badge variant="secondary">Загрузка</Badge>
}

function normalizeQuantity(value: string) {
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number.toFixed(3) : value
}

function normalizeMoney(value: string) {
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number.toFixed(2) : value
}

function trimDecimal(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const number = Number(trimmed)
  return Number.isFinite(number) ? String(number) : value
}

function localDate() {
  const value = new Date()
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

function monthRange(value: string) {
  const [year, month] = value.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year!, month!, 0)).getUTCDate()
  return {
    from: `${value}-01`,
    to: `${value}-${String(lastDay).padStart(2, '0')}`,
  }
}

function yearRange(value: string) {
  return { from: `${value}-01-01`, to: `${value}-12-31` }
}
