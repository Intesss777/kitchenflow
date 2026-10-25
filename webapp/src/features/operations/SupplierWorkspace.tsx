import {
  AddInvoiceIcon,
  Edit02Icon,
  MoneyReceiveFlow02Icon,
  PlusSignIcon,
  PrinterIcon,
  StoreAdd02Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  createSupplierLedgerEntryRequestSchema,
  createSupplierRequestSchema,
  type OperationsDashboardResponse,
  type Supplier,
} from '@kitchenflow/contracts'
import { useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

import { SectionCards } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useCreateLedgerEntryMutation,
  useCreateSupplierMutation,
  useSupplierQuery,
  useUpdateSupplierMutation,
} from './queries'

const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})
const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function SupplierWorkspace({ dashboard }: { dashboard: OperationsDashboardResponse }) {
  const [selectedId, setSelectedId] = useState<string | null>(dashboard.suppliers[0]?.id ?? null)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  const [entryType, setEntryType] = useState<'invoice' | 'payment' | null>(null)

  const resolvedSelectedId = selectedId && dashboard.suppliers.some((supplier) => supplier.id === selectedId)
    ? selectedId
    : dashboard.suppliers[0]?.id ?? null
  const selected = dashboard.suppliers.find((supplier) => supplier.id === resolvedSelectedId) ?? null
  return (
    <div className="grid gap-6">
      <SectionCards
        items={[
          {
            description: 'Общая сумма неоплаченных поставок.',
            label: 'Общий долг',
            value: formatMoney(dashboard.metrics.supplierDebt),
          },
          {
            description: 'Активные контрагенты компании.',
            label: 'Поставщиков',
            value: dashboard.metrics.activeSuppliers,
          },
          {
            description: dashboard.metrics.overdueSuppliers
              ? 'Требуют внимания владельца.'
              : 'Просроченных платежей нет.',
            label: 'С просрочкой',
            value: dashboard.metrics.overdueSuppliers,
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div>
              <CardTitle>Контрагенты</CardTitle>
              <CardDescription>Выберите поставщика для просмотра истории</CardDescription>
            </div>
            <Button
              aria-label="Добавить поставщика"
              onClick={() => setSupplierDialogOpen(true)}
              size="icon-sm"
              type="button"
            >
              <HugeiconsIcon icon={PlusSignIcon} />
            </Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {dashboard.suppliers.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center">
                <Typography tone="muted" variant="bodySm">Поставщиков пока нет.</Typography>
                <Button className="mt-4" onClick={() => setSupplierDialogOpen(true)} size="sm">
                  Добавить первого
                </Button>
              </div>
            ) : dashboard.suppliers.map((supplier) => (
              <button
                className={cn(
                  'grid w-full gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted/60',
                  supplier.id === resolvedSelectedId && 'border-primary/40 bg-primary/5',
                )}
                key={supplier.id}
                onClick={() => setSelectedId(supplier.id)}
                type="button"
              >
                <span className="flex items-start justify-between gap-3">
                  <Typography as="span" truncate variant="bodySmMedium">{supplier.name}</Typography>
                  <Typography as="span" className="shrink-0 tabular-nums" variant="bodySmMedium">
                    {formatMoney(supplier.balance)}
                  </Typography>
                </span>
                <span className="flex items-center justify-between gap-3">
                  <Typography as="span" truncate tone="muted" variant="caption">
                    {supplier.contactName ?? supplier.phone ?? 'Контакт не указан'}
                  </Typography>
                  {supplier.isOverdue && <Badge variant="destructive">Просрочено</Badge>}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>

        {selected ? (
          <SupplierDetail
            onAddEntry={setEntryType}
            supplier={selected}
          />
        ) : (
          <Card>
            <CardContent className="grid min-h-72 place-items-center p-8 text-center">
              <div>
                <HugeiconsIcon className="mx-auto mb-4 text-muted-foreground" icon={StoreAdd02Icon} size={32} />
                <Typography as="h2" variant="h5">Добавьте поставщика</Typography>
                <Typography className="mt-2" tone="muted" variant="bodySm">
                  После этого здесь появятся долг и история операций.
                </Typography>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <SupplierFormDialog
        onSaved={(supplierId) => setSelectedId(supplierId)}
        onOpenChange={setSupplierDialogOpen}
        open={supplierDialogOpen}
      />
      {selected && (
        <CreateEntryDialog
          onOpenChange={(open) => {
            if (!open) setEntryType(null)
          }}
          open={entryType !== null}
          supplier={selected}
          type={entryType ?? 'invoice'}
        />
      )}
    </div>
  )
}

function SupplierDetail({
  onAddEntry,
  supplier,
}: {
  onAddEntry: (type: 'invoice' | 'payment') => void
  supplier: Supplier
}) {
  const query = useSupplierQuery(supplier.id)
  const resolvedSupplier = query.data?.supplier ?? supplier
  const canPrintCompanyCard = hasCompanyDetails(resolvedSupplier)
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false)
  return (
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{supplier.name}</CardTitle>
          <CardDescription>
            {supplier.contactName ?? 'Контакт не указан'}
            {supplier.phone ? ` · ${supplier.phone}` : ''}
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setSupplierDialogOpen(true)} size="sm" type="button" variant="outline">
            <HugeiconsIcon icon={Edit02Icon} />
            Реквизиты
          </Button>
          <Button
            disabled={!canPrintCompanyCard}
            onClick={printSupplierCompanyCard}
            size="sm"
            title={canPrintCompanyCard ? 'Открыть карточку предприятия для сохранения в PDF' : 'Сначала заполните реквизиты поставщика'}
            type="button"
            variant="outline"
          >
            <HugeiconsIcon icon={PrinterIcon} />
            Скачать PDF
          </Button>
          <Button onClick={() => onAddEntry('invoice')} size="sm" type="button">
            <HugeiconsIcon icon={AddInvoiceIcon} />
            Накладная
          </Button>
          <Button onClick={() => onAddEntry('payment')} size="sm" type="button" variant="outline">
            <HugeiconsIcon icon={MoneyReceiveFlow02Icon} />
            Оплата
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
          <SummaryItem label="Текущий долг" value={formatMoney(supplier.balance)} />
          <SummaryItem label="Отсрочка" value={`${supplier.paymentTermsDays} дн.`} />
          <SummaryItem
            label="Ближайшая оплата"
            value={supplier.nextDueAt ? dateFormatter.format(new Date(supplier.nextDueAt)) : 'Не указана'}
          />
        </div>

        <CompanyDetails supplier={resolvedSupplier} />

        <div>
          <Typography as="h3" variant="h6">История операций</Typography>
          <Typography tone="muted" variant="bodySm">Накладные и погашения по датам</Typography>
        </div>
        {query.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Не удалось загрузить историю</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : query.data.entries.length === 0 ? (
          <div className="rounded-xl border border-dashed p-7 text-center">
            <Typography tone="muted" variant="bodySm">Операций по этому поставщику пока нет.</Typography>
          </div>
        ) : (
          <div className="grid gap-2">
            {query.data.entries.map((entry) => (
              <div className="flex items-start justify-between gap-4 rounded-xl border p-4" key={entry.id}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography as="span" variant="bodySmMedium">
                      {entry.type === 'payment' ? 'Оплата' : 'Накладная'}
                    </Typography>
                    {entry.reference && <Badge variant="outline">{entry.reference}</Badge>}
                  </div>
                  <Typography className="mt-1" tone="muted" variant="caption">
                    {dateFormatter.format(new Date(entry.occurredAt))}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </Typography>
                </div>
                <Typography
                  className={cn(
                    'shrink-0 tabular-nums',
                    entry.type === 'payment' && 'text-emerald-700 dark:text-emerald-400',
                  )}
                  variant="bodySmMedium"
                >
                  {entry.type === 'payment' ? '−' : '+'}{formatMoney(entry.amount)}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <SupplierCompanyCardPrintSheet supplier={resolvedSupplier} />
      <SupplierFormDialog
        onOpenChange={setSupplierDialogOpen}
        onSaved={() => setSupplierDialogOpen(false)}
        open={supplierDialogOpen}
        supplier={resolvedSupplier}
      />
    </Card>
  )
}

function CompanyDetails({ supplier }: { supplier: Supplier }) {
  if (!hasCompanyDetails(supplier)) {
    return (
      <div className="rounded-xl border border-dashed p-5">
        <Typography as="h3" variant="h6">Карточка предприятия</Typography>
        <Typography className="mt-1" tone="muted" variant="bodySm">
          Реквизиты пока не заполнены. Их можно указать при добавлении поставщика.
        </Typography>
      </div>
    )
  }
  const rows = supplierCompanyCardRows(supplier)
  return (
    <div className="rounded-xl border p-5">
      <Typography as="h3" variant="h6">Карточка предприятия</Typography>
      <div className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map((row) => (
          <SummaryItem key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  )
}

function SupplierCompanyCardPrintSheet({ supplier }: { supplier: Supplier }) {
  return createPortal(
    <main className="hidden bg-background text-foreground" data-supplier-company-card-print-sheet>
      <div className="border-b pb-5">
        <Typography as="p" tone="muted" variant="bodySm">KitchenFlow</Typography>
        <Typography as="h1" className="mt-2" variant="h2">Карточка предприятия</Typography>
        <Typography as="p" className="mt-2" variant="h5">
          {supplier.legalName ?? supplier.name}
        </Typography>
      </div>
      <div className="mt-6 grid gap-4">
        {supplierCompanyCardRows(supplier).map((row) => (
          <div className="grid grid-cols-3 gap-6 border-b pb-3" key={row.label}>
            <Typography as="span" tone="muted" variant="bodySm">{row.label}</Typography>
            <Typography as="span" className="col-span-2" variant="bodySmMedium">{row.value}</Typography>
          </div>
        ))}
      </div>
    </main>,
    document.body,
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography tone="muted" variant="caption">{label}</Typography>
      <Typography className="mt-1 tabular-nums" variant="bodySmMedium">{value}</Typography>
    </div>
  )
}

function SupplierFormDialog({
  onOpenChange,
  onSaved,
  open,
  supplier,
}: {
  onOpenChange: (open: boolean) => void
  onSaved: (supplierId: string) => void
  open: boolean
  supplier?: Supplier
}) {
  const createMutation = useCreateSupplierMutation()
  const updateMutation = useUpdateSupplierMutation(supplier?.id ?? '')
  const mutation = supplier ? updateMutation : createMutation
  const [validationError, setValidationError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = createSupplierRequestSchema.safeParse({
      name: form.get('name'),
      legalName: emptyToNull(form.get('legalName')),
      taxId: emptyToNull(form.get('taxId')),
      registrationReasonCode: emptyToNull(form.get('registrationReasonCode')),
      registrationNumber: emptyToNull(form.get('registrationNumber')),
      legalAddress: emptyToNull(form.get('legalAddress')),
      bankName: emptyToNull(form.get('bankName')),
      bankBik: emptyToNull(form.get('bankBik')),
      correspondentAccount: emptyToNull(form.get('correspondentAccount')),
      settlementAccount: emptyToNull(form.get('settlementAccount')),
      contactName: emptyToNull(form.get('contactName')),
      phone: emptyToNull(form.get('phone')),
      whatsappPhone: emptyToNull(form.get('whatsappPhone')),
      paymentTermsDays: Number(form.get('paymentTermsDays')),
    })
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Проверьте введённые данные')
      return
    }
    setValidationError(null)
    mutation.mutate(parsed.data, {
      onSuccess: (response) => {
        onSaved(response.supplier.id)
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && mutation.isPending) return
      mutation.reset()
      setValidationError(null)
      onOpenChange(next)
    }}>
      <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{supplier ? 'Реквизиты поставщика' : 'Новый поставщик'}</DialogTitle>
          <DialogDescription>Контакты, реквизиты для безналичной оплаты и стандартная отсрочка.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field><FieldLabel htmlFor="supplier-name">Название</FieldLabel><Input autoFocus defaultValue={supplier?.name} id="supplier-name" name="name" placeholder="Например, Фреш Маркет" required /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="supplier-contact">Контакт</FieldLabel><Input defaultValue={supplier?.contactName ?? ''} id="supplier-contact" name="contactName" placeholder="Имя менеджера" /></Field>
              <Field><FieldLabel htmlFor="supplier-terms">Отсрочка, дней</FieldLabel><Input defaultValue={supplier?.paymentTermsDays ?? 0} id="supplier-terms" min="0" max="365" name="paymentTermsDays" type="number" /></Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="supplier-phone">Телефон</FieldLabel><Input defaultValue={supplier?.phone ?? ''} id="supplier-phone" name="phone" placeholder="+7 900 000-00-00" type="tel" /></Field>
              <Field><FieldLabel htmlFor="supplier-whatsapp">WhatsApp</FieldLabel><Input defaultValue={supplier?.whatsappPhone ?? ''} id="supplier-whatsapp" name="whatsappPhone" placeholder="79000000000" type="tel" /></Field>
            </div>
            <div className="border-t pt-4">
              <Typography as="h3" variant="h6">Реквизиты компании</Typography>
              <Typography tone="muted" variant="caption">Для карточки предприятия и оплаты по безналу</Typography>
            </div>
            <Field><FieldLabel htmlFor="supplier-legal-name">Полное юридическое наименование</FieldLabel><Input defaultValue={supplier?.legalName ?? ''} id="supplier-legal-name" name="legalName" placeholder="ООО «Фреш Маркет» или ИП Иванов Иван Иванович" /></Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field><FieldLabel htmlFor="supplier-tax-id">ИНН</FieldLabel><Input defaultValue={supplier?.taxId ?? ''} id="supplier-tax-id" inputMode="numeric" name="taxId" placeholder="10 или 12 цифр" /></Field>
              <Field><FieldLabel htmlFor="supplier-kpp">КПП</FieldLabel><Input defaultValue={supplier?.registrationReasonCode ?? ''} id="supplier-kpp" inputMode="numeric" name="registrationReasonCode" placeholder="9 цифр" /></Field>
              <Field><FieldLabel htmlFor="supplier-registration-number">ОГРН / ОГРНИП</FieldLabel><Input defaultValue={supplier?.registrationNumber ?? ''} id="supplier-registration-number" inputMode="numeric" name="registrationNumber" placeholder="13 или 15 цифр" /></Field>
            </div>
            <Field><FieldLabel htmlFor="supplier-legal-address">Юридический адрес</FieldLabel><Input defaultValue={supplier?.legalAddress ?? ''} id="supplier-legal-address" name="legalAddress" placeholder="Индекс, город, улица, дом" /></Field>
            <div className="border-t pt-4">
              <Typography as="h3" variant="h6">Банковские реквизиты</Typography>
            </div>
            <Field><FieldLabel htmlFor="supplier-bank-name">Банк</FieldLabel><Input defaultValue={supplier?.bankName ?? ''} id="supplier-bank-name" name="bankName" placeholder="Наименование банка" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="supplier-bank-bik">БИК</FieldLabel><Input defaultValue={supplier?.bankBik ?? ''} id="supplier-bank-bik" inputMode="numeric" name="bankBik" placeholder="9 цифр" /></Field>
              <Field><FieldLabel htmlFor="supplier-settlement-account">Расчётный счёт</FieldLabel><Input defaultValue={supplier?.settlementAccount ?? ''} id="supplier-settlement-account" inputMode="numeric" name="settlementAccount" placeholder="20 цифр" /></Field>
            </div>
            <Field><FieldLabel htmlFor="supplier-correspondent-account">Корреспондентский счёт</FieldLabel><Input defaultValue={supplier?.correspondentAccount ?? ''} id="supplier-correspondent-account" inputMode="numeric" name="correspondentAccount" placeholder="20 цифр" /></Field>
          </FieldGroup>
          {(validationError || mutation.isError) && (
            <Alert variant="destructive"><AlertTitle>Поставщик не добавлен</AlertTitle><AlertDescription>{validationError ?? mutation.error?.message}</AlertDescription></Alert>
          )}
          <DialogFooter>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Сохраняем…' : supplier ? 'Сохранить реквизиты' : 'Добавить поставщика'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateEntryDialog({
  onOpenChange,
  open,
  supplier,
  type,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  supplier: Supplier
  type: 'invoice' | 'payment'
}) {
  const mutation = useCreateLedgerEntryMutation()
  const [validationError, setValidationError] = useState<string | null>(null)
  const [defaultDates] = useState(() => {
    const now = new Date()
    return {
      today: dateToInputValue(now),
      due: dateToInputValue(
        new Date(now.getTime() + supplier.paymentTermsDays * 24 * 60 * 60 * 1000),
      ),
    }
  })

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = createSupplierLedgerEntryRequestSchema.safeParse({
      type,
      amount: normalizeMoney(String(form.get('amount') ?? '')),
      occurredAt: dateInputToIso(String(form.get('occurredAt'))),
      dueAt: type === 'invoice' ? dateInputToIso(String(form.get('dueAt'))) : null,
      reference: emptyToNull(form.get('reference')),
      note: emptyToNull(form.get('note')),
    })
    if (!parsed.success) {
      setValidationError('Проверьте сумму и даты операции')
      return
    }
    setValidationError(null)
    mutation.mutate({ supplierId: supplier.id, input: parsed.data }, {
      onSuccess: () => onOpenChange(false),
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      if (!next && mutation.isPending) return
      mutation.reset()
      setValidationError(null)
      onOpenChange(next)
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === 'invoice' ? 'Добавить накладную' : 'Зафиксировать оплату'}</DialogTitle>
          <DialogDescription>{supplier.name} · данные сразу попадут в задолженность</DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field><FieldLabel htmlFor="entry-amount">Сумма, ₽</FieldLabel><Input autoFocus id="entry-amount" min="0.01" name="amount" placeholder="0,00" required step="0.01" type="number" /></Field>
              <Field><FieldLabel htmlFor="entry-date">Дата</FieldLabel><Input defaultValue={defaultDates.today} id="entry-date" name="occurredAt" required type="date" /></Field>
            </div>
            {type === 'invoice' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field><FieldLabel htmlFor="entry-due">Оплатить до</FieldLabel><Input defaultValue={defaultDates.due} id="entry-due" name="dueAt" required type="date" /></Field>
                <Field><FieldLabel htmlFor="entry-reference">Номер накладной</FieldLabel><Input id="entry-reference" name="reference" placeholder="ФМ-1048" /></Field>
              </div>
            )}
            <Field><FieldLabel htmlFor="entry-note">Комментарий</FieldLabel><Input id="entry-note" name="note" placeholder={type === 'payment' ? 'Например, частичная оплата' : 'Что поступило'} /></Field>
          </FieldGroup>
          {(validationError || mutation.isError) && (
            <Alert variant="destructive"><AlertTitle>Операция не сохранена</AlertTitle><AlertDescription>{validationError ?? mutation.error?.message}</AlertDescription></Alert>
          )}
          <DialogFooter>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Сохраняем…' : type === 'invoice' ? 'Добавить накладную' : 'Зафиксировать оплату'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function emptyToNull(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  return text || null
}

function normalizeMoney(value: string) {
  const amount = Number(value.replace(',', '.'))
  return Number.isFinite(amount) ? amount.toFixed(2) : value
}

function dateInputToIso(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toISOString()
}

function dateToInputValue(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMoney(value: string) {
  return currency.format(Number(value))
}

function hasCompanyDetails(supplier: Supplier) {
  return Boolean(
    supplier.legalName
    || supplier.taxId
    || supplier.registrationNumber
    || supplier.legalAddress
    || supplier.bankName
    || supplier.bankBik
    || supplier.settlementAccount
    || supplier.correspondentAccount,
  )
}

function supplierCompanyCardRows(supplier: Supplier) {
  return [
    { label: 'Краткое наименование', value: supplier.name },
    { label: 'Юридическое наименование', value: supplier.legalName },
    { label: 'ИНН', value: supplier.taxId },
    { label: 'КПП', value: supplier.registrationReasonCode },
    { label: 'ОГРН / ОГРНИП', value: supplier.registrationNumber },
    { label: 'Юридический адрес', value: supplier.legalAddress },
    { label: 'Банк', value: supplier.bankName },
    { label: 'БИК', value: supplier.bankBik },
    { label: 'Расчётный счёт', value: supplier.settlementAccount },
    { label: 'Корреспондентский счёт', value: supplier.correspondentAccount },
    { label: 'Контактное лицо', value: supplier.contactName },
    { label: 'Телефон', value: supplier.phone },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value))
}

function printSupplierCompanyCard() {
  const root = document.documentElement
  const wasDark = root.classList.contains('dark')
  const finishPrinting = () => {
    document.body.classList.remove('supplier-company-card-printing')
    if (wasDark) root.classList.add('dark')
    window.removeEventListener('afterprint', finishPrinting)
  }
  document.body.classList.add('supplier-company-card-printing')
  root.classList.remove('dark')
  window.addEventListener('afterprint', finishPrinting)
  window.print()
}
