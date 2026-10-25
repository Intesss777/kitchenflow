import {
  Add01Icon,
  CameraAdd02Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Invoice01Icon,
  ScanTextIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  updateSalesShiftRequestSchema,
  type InventoryUnit,
  type SalesShift,
  type SalesShiftsOverviewResponse,
} from '@kitchenflow/contracts'
import { useRef, useState, type ChangeEvent } from 'react'

import { CompactMetrics } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useConfirmSalesShiftMutation,
  useSalesShiftQuery,
  useUpdateSalesShiftMutation,
  useUploadSalesReceiptMutation,
} from './queries'

const units: Record<InventoryUnit, string> = {
  kilogram: 'кг',
  gram: 'г',
  liter: 'л',
  milliliter: 'мл',
  piece: 'шт.',
}
const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function ShiftsWorkspace({ data }: { data: SalesShiftsOverviewResponse }) {
  const [selectedId, setSelectedId] = useState<string | null>(
    data.shifts.find((shift) => shift.status === 'review')?.id ?? data.shifts[0]?.id ?? null,
  )
  const [shiftDate, setShiftDate] = useState(data.workspace.businessDate)
  const input = useRef<HTMLInputElement>(null)
  const upload = useUploadSalesReceiptMutation()
  const resolvedId = selectedId && data.shifts.some((shift) => shift.id === selectedId)
    ? selectedId
    : data.shifts.find((shift) => shift.status === 'review')?.id ?? data.shifts[0]?.id ?? null

  function pickPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ''
    if (files.length === 0) return
    void files.reduce<Promise<void>>(async (previous, file) => {
      await previous
      const response = await upload.mutateAsync({ file, shiftDate })
      setSelectedId(response.shift.id)
    }, Promise.resolve()).catch(() => undefined)
  }

  return (
    <div className="grid gap-6">
      <CompactMetrics items={[
        { label: 'Чеков сегодня', value: data.metrics.receiptsToday, description: 'Фотографии в текущей смене.' },
        { label: 'Блюд сегодня', value: data.metrics.dishesToday, description: 'По распознанным и проверенным чекам.' },
        { label: 'Ждут проверки', value: data.metrics.needsReview, description: 'Склад ещё не изменён.' },
        { label: 'Закрыто за месяц', value: data.metrics.confirmedThisMonth, description: `Филиал: ${data.workspace.branchName}` },
      ]} />

      <Card className="border-primary/20">
        <CardContent className="flex flex-col gap-5 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground"><HugeiconsIcon icon={CameraAdd02Icon} size={24} /></span>
            <Typography as="h2" variant="h5">Добавьте чеки смены</Typography>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field><FieldLabel htmlFor="shift-date">Дата смены</FieldLabel><Input id="shift-date" max={data.workspace.businessDate} onChange={(event) => setShiftDate(event.target.value)} type="date" value={shiftDate} /></Field>
            <Button disabled={upload.isPending} onClick={() => input.current?.click()} size="lg"><HugeiconsIcon icon={upload.isPending ? ScanTextIcon : CameraAdd02Icon} />{upload.isPending ? 'Распознаём…' : 'Фото чеков'}</Button>
            <input accept="image/jpeg,image/png,image/heic,image/heif" aria-label="Фотографии чеков" capture="environment" className="sr-only" multiple onChange={pickPhotos} ref={input} type="file" />
          </div>
        </CardContent>
      </Card>

      {upload.isError && <Alert variant="destructive"><AlertTitle>Чек не добавлен</AlertTitle><AlertDescription>{upload.error.message}</AlertDescription></Alert>}

      <div className="grid gap-6 xl:grid-cols-[300px_minmax(0,1fr)] xl:items-start">
        <ShiftList onSelect={setSelectedId} selectedId={resolvedId} shifts={data.shifts} />
        {resolvedId ? <ShiftDetail data={data} shiftId={resolvedId} /> : <EmptyShift />}
      </div>
    </div>
  )
}

function ShiftList({ onSelect, selectedId, shifts }: { onSelect: (id: string) => void; selectedId: string | null; shifts: SalesShiftsOverviewResponse['shifts'] }) {
  return (
    <Card><CardHeader><CardTitle>Смены</CardTitle></CardHeader><CardContent className="grid gap-2">
      {shifts.length === 0 ? <Typography tone="muted" variant="bodySm">Добавьте первый чек, чтобы открыть смену.</Typography> : shifts.map((shift) => (
        <button className={cn('grid gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted/60', selectedId === shift.id && 'border-primary/40 bg-primary/5')} key={shift.id} onClick={() => onSelect(shift.id)} type="button">
          <span className="flex items-center justify-between gap-3"><Typography as="span" variant="bodySmMedium">{formatDate(shift.shiftDate)}</Typography><ShiftStatus status={shift.status} /></span>
          <Typography as="span" tone="muted" variant="caption">{plural(shift.receiptCount, 'чек', 'чека', 'чеков')} · {plural(shift.dishCount, 'блюдо', 'блюда', 'блюд')}</Typography>
        </button>
      ))}
    </CardContent></Card>
  )
}

function ShiftDetail({ data, shiftId }: { data: SalesShiftsOverviewResponse; shiftId: string }) {
  const query = useSalesShiftQuery(shiftId)
  if (query.isPending) return <Card><CardContent aria-label="Загрузка выбранной смены" className="grid gap-4 p-6" role="status"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></CardContent></Card>
  if (query.isError) return <Alert variant="destructive"><AlertTitle>Не удалось открыть смену</AlertTitle><AlertDescription>{query.error.message}</AlertDescription><Button className="mt-3" onClick={() => void query.refetch()} size="sm" variant="outline">Повторить</Button></Alert>
  const shift = query.data.shift
  const reviewKey = `${shift.id}:${shift.receipts.length}:${shift.lines.map((line) => `${line.dishId}-${line.quantity}`).join(',')}`
  return shift.status === 'review'
    ? <ShiftReview data={data} key={reviewKey} shift={shift} />
    : <ConfirmedShift shift={shift} />
}

type EditableLine = { key: string; dishId: string; quantity: string }

function ShiftReview({ data, shift }: { data: SalesShiftsOverviewResponse; shift: SalesShift }) {
  const update = useUpdateSalesShiftMutation()
  const confirm = useConfirmSalesShiftMutation()
  const [lines, setLines] = useState<EditableLine[]>(() => shift.lines.map((line) => ({ key: line.id, dishId: line.dishId, quantity: String(line.quantity) })))
  const [error, setError] = useState<string | null>(null)
  const busy = update.isPending || confirm.isPending

  function payload() {
    const parsed = updateSalesShiftRequestSchema.safeParse({
      lines: lines.map((line) => ({ dishId: line.dishId, quantity: Number(line.quantity) })),
    })
    if (!parsed.success) {
      setError('Выберите блюдо и укажите целое количество больше нуля. Одинаковые блюда объедините в одну строку.')
      return null
    }
    setError(null)
    return parsed.data
  }

  async function save() {
    const input = payload()
    if (input) await update.mutateAsync({ shiftId: shift.id, input })
  }

  async function saveAndConfirm() {
    const input = payload()
    if (!input) return
    try {
      await update.mutateAsync({ shiftId: shift.id, input })
      await confirm.mutateAsync(shift.id)
    } catch {
      // The mutations expose the server message below.
    }
  }

  return (
    <Card>
      <CardHeader className="gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="flex flex-wrap items-center gap-2"><CardTitle>Смена за {formatDate(shift.shiftDate)}</CardTitle><Badge variant="outline"><HugeiconsIcon icon={ScanTextIcon} />Демо OCR</Badge><Badge variant="secondary">{plural(shift.receipts.length, 'фото', 'фото', 'фото')}</Badge></div><ShiftStatus status={shift.status} /></div>
      </CardHeader>
      <CardContent className="grid gap-7">
        <ReceiptStrip receipts={shift.receipts} />
        <div className="grid gap-3">
          <div className="flex items-end justify-between gap-4"><Typography as="h3" variant="h6">Проданные блюда</Typography><Typography className="tabular-nums" variant="h6">{lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0)} шт.</Typography></div>
          {lines.map((line, index) => (
            <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end" key={line.key}>
              <Field><FieldLabel htmlFor={`shift-dish-${index}`}>Блюдо</FieldLabel><NativeSelect className="w-full" id={`shift-dish-${index}`} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, dishId: event.target.value } : item))} value={line.dishId}><NativeSelectOption value="">Выберите блюдо</NativeSelectOption>{data.dishes.map((dish) => <NativeSelectOption key={dish.id} value={dish.id}>{dish.name}</NativeSelectOption>)}</NativeSelect></Field>
              <Field><FieldLabel htmlFor={`shift-quantity-${index}`}>Количество</FieldLabel><Input id={`shift-quantity-${index}`} min="1" onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} step="1" type="number" value={line.quantity} /></Field>
              <Button aria-label="Удалить позицию" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} size="icon" type="button" variant="ghost"><HugeiconsIcon icon={Delete02Icon} /></Button>
            </div>
          ))}
          <Button className="justify-self-start" onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), dishId: '', quantity: '1' }])} size="sm" type="button" variant="outline"><HugeiconsIcon icon={Add01Icon} />Добавить блюдо</Button>
        </div>

        <ConsumptionPreview consumption={shift.consumption} />

        {(error || update.isError || confirm.isError) && <Alert variant="destructive"><AlertTitle>Смена не подтверждена</AlertTitle><AlertDescription>{error ?? update.error?.message ?? confirm.error?.message}</AlertDescription></Alert>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button disabled={busy} onClick={() => void save()} variant="outline">{update.isPending ? 'Сохраняем…' : 'Сохранить проверку'}</Button><Button disabled={busy} onClick={() => void saveAndConfirm()}><HugeiconsIcon icon={CheckmarkCircle02Icon} />{confirm.isPending ? 'Списываем…' : 'Подтвердить и списать'}</Button></div>
      </CardContent>
    </Card>
  )
}

function ReceiptStrip({ receipts }: { receipts: SalesShift['receipts'] }) {
  return (
    <div className="grid gap-3"><Typography as="h3" variant="h6">Фотографии чеков</Typography><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{receipts.map((receipt, index) => <ReceiptImage index={index} key={receipt.id} receipt={receipt} />)}</div></div>
  )
}

function ReceiptImage({ index, receipt }: { index: number; receipt: SalesShift['receipts'][number] }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="grid aspect-video place-items-center overflow-hidden rounded-xl border bg-muted/50">{receipt.imageUrl && !failed ? <img alt={`Чек ${index + 1}`} className="size-full object-cover" onError={() => setFailed(true)} src={receipt.imageUrl} /> : <div className="text-center"><HugeiconsIcon className="mx-auto text-muted-foreground" icon={Invoice01Icon} size={28} /><Typography className="mt-2" tone="muted" variant="caption">Чек {index + 1}</Typography></div>}</div>
  )
}

function ConsumptionPreview({ consumption }: { consumption: SalesShift['consumption'] }) {
  return (
    <div className="grid gap-3"><Typography as="h3" variant="h6">Расход продуктов</Typography>
      {consumption.length === 0 ? <div className="rounded-xl border border-dashed p-6 text-center"><Typography tone="muted" variant="bodySm">Добавьте блюда, чтобы увидеть расход.</Typography></div> : <div className="grid gap-2">{consumption.map((item) => <div className="grid gap-2 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" key={item.productId}><Typography variant="bodySmMedium">{item.productName}</Typography><div className="flex flex-wrap items-center gap-2 tabular-nums"><Badge variant="outline">{trim(item.quantityBefore)} {units[item.unit]}</Badge><Typography as="span" tone="muted" variant="caption">− {trim(item.quantityUsed)}</Typography><Badge variant={Number(item.quantityAfter) < 0 ? 'destructive' : 'secondary'}>{trim(item.quantityAfter)} {units[item.unit]}</Badge></div></div>)}</div>}
    </div>
  )
}

function ConfirmedShift({ shift }: { shift: SalesShift }) {
  return (
    <Card><CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between"><div><CardTitle>Смена за {formatDate(shift.shiftDate)}</CardTitle><CardDescription>{plural(shift.receipts.length, 'чек', 'чека', 'чеков')} · {plural(shift.lines.reduce((sum, line) => sum + line.quantity, 0), 'блюдо', 'блюда', 'блюд')}</CardDescription></div><ShiftStatus status={shift.status} /></CardHeader><CardContent className="grid gap-6"><Alert><HugeiconsIcon icon={CheckmarkCircle02Icon} /><AlertTitle>Смена закрыта</AlertTitle><AlertDescription>Теоретический расход проведён по складу. Повторное открытие этой смены не создаст второе списание.</AlertDescription></Alert><ConsumptionPreview consumption={shift.consumption} /><Typography tone="muted" variant="caption">Подтвердил: {shift.confirmedByName ?? 'Сотрудник'}</Typography></CardContent></Card>
  )
}

function EmptyShift() {
  return <Card><CardContent className="grid min-h-80 place-items-center p-8 text-center"><div><HugeiconsIcon className="mx-auto text-muted-foreground" icon={Invoice01Icon} size={40} /><Typography as="h2" className="mt-4" variant="h5">Смена ещё не открыта</Typography><Typography className="mt-2" tone="muted" variant="bodySm">Добавьте фотографии чеков — KitchenFlow соберёт их в один черновик.</Typography></div></CardContent></Card>
}

function ShiftStatus({ status }: { status: SalesShift['status'] }) {
  return status === 'confirmed' ? <Badge variant="outline">Закрыта</Badge> : <Badge>Проверить</Badge>
}

function formatDate(date: string) {
  return dateFormat.format(new Date(`${date}T00:00:00.000Z`))
}

function plural(value: number, one: string, few: string, many: string) {
  const modulo100 = value % 100
  const modulo10 = value % 10
  const word = modulo100 >= 11 && modulo100 <= 14
    ? many
    : modulo10 === 1
      ? one
      : modulo10 >= 2 && modulo10 <= 4
        ? few
        : many
  return `${value} ${word}`
}

function trim(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? String(number) : value
}
