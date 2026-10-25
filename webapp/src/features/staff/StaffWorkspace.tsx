import {
  Add01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ClockAlertIcon,
  Money03Icon,
  UserAdd01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  createStaffEmployeeRequestSchema,
  createStaffEventRequestSchema,
  type StaffEmployee,
  type StaffEvent,
  type StaffEventType,
  type StaffOverviewResponse,
} from '@kitchenflow/contracts'
import { useState, type FormEvent } from 'react'

import { SectionCards } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { calendarCells, monthLabel, shiftMonth } from './model'
import { useCreateStaffEmployeeMutation, useCreateStaffEventMutation } from './queries'

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const currency = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 })

export function StaffWorkspace({
  month,
  onMonthChange,
  onSelectedEmployeeIdChange,
  overview,
  selectedEmployeeId,
}: {
  month: string
  onMonthChange: (month: string) => void
  onSelectedEmployeeIdChange: (id: string) => void
  overview: StaffOverviewResponse
  selectedEmployeeId: string | null
}) {
  const [employeeDialogOpen, setEmployeeDialogOpen] = useState(false)
  const [eventType, setEventType] = useState<StaffEventType | null>(null)
  const resolvedId = selectedEmployeeId && overview.employees.some((employee) => employee.id === selectedEmployeeId)
    ? selectedEmployeeId
    : overview.employees[0]?.id ?? null
  const selected = overview.employees.find((employee) => employee.id === resolvedId) ?? null
  const selectedEvents = overview.events.filter((event) => event.employeeId === resolvedId)
  const metrics = [
    { label: 'Сотрудников', value: overview.metrics.activeEmployees, description: `Филиал: ${overview.workspace.branchName}` },
    { label: 'Опозданий', value: overview.metrics.latenessCount, description: monthLabel(month) },
    { label: 'Штрафы за месяц', value: currency.format(Number(overview.metrics.fineTotal)), description: 'Только ручной учёт, без удержания.' },
  ]

  return (
    <div className="grid gap-6">
      <SectionCards items={metrics} />
      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3">
            <div><CardTitle>Сотрудники</CardTitle><CardDescription>Работники филиала без входа в приложение</CardDescription></div>
            <Button aria-label="Добавить сотрудника" onClick={() => setEmployeeDialogOpen(true)} size="icon-sm"><HugeiconsIcon icon={UserAdd01Icon} /></Button>
          </CardHeader>
          <CardContent className="grid gap-2">
            {overview.employees.length === 0 ? (
              <div className="rounded-xl border border-dashed p-6 text-center"><Typography tone="muted" variant="bodySm">Добавьте первого сотрудника.</Typography></div>
            ) : overview.employees.map((employee) => {
              const events = overview.events.filter((event) => event.employeeId === employee.id)
              return (
                <button
                  className={cn('grid gap-2 rounded-xl border p-4 text-left transition-colors hover:bg-muted/60', employee.id === resolvedId && 'border-primary/40 bg-primary/5')}
                  key={employee.id}
                  onClick={() => onSelectedEmployeeIdChange(employee.id)}
                  type="button"
                >
                  <Typography as="span" variant="bodySmMedium">{employee.name}</Typography>
                  <span className="flex items-center justify-between gap-2">
                    <Typography as="span" tone="muted" variant="caption">{employee.position}</Typography>
                    {events.length > 0 && <Badge variant="outline">{events.length} событий</Badge>}
                  </span>
                </button>
              )
            })}
          </CardContent>
        </Card>

        {selected ? (
          <Card>
            <CardHeader className="gap-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><CardTitle>{selected.name}</CardTitle><CardDescription>{selected.position}</CardDescription></div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => setEventType('lateness')} size="sm" variant="outline"><HugeiconsIcon icon={ClockAlertIcon} />Опоздание</Button>
                  <Button onClick={() => setEventType('fine')} size="sm"><HugeiconsIcon icon={Money03Icon} />Штраф</Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border p-2">
                <Button aria-label="Предыдущий месяц" onClick={() => onMonthChange(shiftMonth(month, -1))} size="icon-sm" variant="ghost"><HugeiconsIcon icon={ArrowLeft01Icon} /></Button>
                <Typography className="capitalize" variant="bodySmMedium">{monthLabel(month)}</Typography>
                <Button aria-label="Следующий месяц" onClick={() => onMonthChange(shiftMonth(month, 1))} size="icon-sm" variant="ghost"><HugeiconsIcon icon={ArrowRight01Icon} /></Button>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6">
              <StaffCalendar events={selectedEvents} month={month} />
              <EventList events={selectedEvents} />
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="grid min-h-72 place-items-center p-8 text-center"><Typography tone="muted">Добавьте сотрудника, чтобы фиксировать события.</Typography></CardContent></Card>
        )}
      </div>
      <CreateEmployeeDialog month={month} onCreated={onSelectedEmployeeIdChange} onOpenChange={setEmployeeDialogOpen} open={employeeDialogOpen} />
      {selected && <CreateEventDialog employee={selected} month={month} onOpenChange={(open) => { if (!open) setEventType(null) }} open={eventType !== null} type={eventType ?? 'lateness'} />}
    </div>
  )
}

function StaffCalendar({ events, month }: { events: StaffEvent[]; month: string }) {
  const byDate = new Map<string, StaffEvent[]>()
  events.forEach((event) => byDate.set(event.occurredOn, [...(byDate.get(event.occurredOn) ?? []), event]))
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-7 gap-1">{weekdays.map((day) => <Typography align="center" key={day} tone="muted" variant="caption">{day}</Typography>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {calendarCells(month).map((cell, index) => {
          if (!cell) return <div aria-hidden className="aspect-square" key={`empty-${index}`} />
          const dayEvents = byDate.get(cell.date) ?? []
          const hasLate = dayEvents.some((event) => event.type === 'lateness')
          const hasFine = dayEvents.some((event) => event.type === 'fine')
          return (
            <div aria-label={`${cell.date}: ${dayEvents.length} событий`} className="grid aspect-square min-w-0 content-between rounded-lg border p-1.5 sm:p-2" key={cell.date}>
              <Typography as="span" variant="caption">{cell.day}</Typography>
              <span className="flex gap-1">
                {hasLate && <span aria-label="Опоздание" className="size-1.5 rounded-full bg-primary" />}
                {hasFine && <span aria-label="Штраф" className="size-1.5 rounded-full bg-destructive" />}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap gap-4">
        <Typography tone="muted" variant="caption">● Опоздание</Typography>
        <Typography tone="muted" variant="caption">● Штраф</Typography>
      </div>
    </div>
  )
}

function EventList({ events }: { events: StaffEvent[] }) {
  return (
    <div className="grid gap-3">
      <Typography as="h3" variant="h6">События месяца</Typography>
      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center"><Typography tone="muted" variant="bodySm">В этом месяце событий нет.</Typography></div>
      ) : events.map((event) => (
        <div className="flex items-start justify-between gap-4 rounded-xl border p-4" key={event.id}>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><Badge variant={event.type === 'fine' ? 'destructive' : 'outline'}>{event.type === 'fine' ? 'Штраф' : 'Опоздание'}</Badge><Typography as="span" variant="bodySmMedium">{formatEventDate(event.occurredOn)}</Typography></div>
            <Typography className="mt-2" variant="bodySm">{event.reason}</Typography>
            <Typography className="mt-1" tone="muted" variant="caption">Внёс: {event.createdByName}</Typography>
          </div>
          <Typography className="shrink-0 tabular-nums" variant="bodySmMedium">{event.type === 'fine' ? currency.format(Number(event.fineAmount)) : event.arrivalTime}</Typography>
        </div>
      ))}
    </div>
  )
}

function CreateEmployeeDialog({ month, onCreated, onOpenChange, open }: { month: string; onCreated: (id: string) => void; onOpenChange: (open: boolean) => void; open: boolean }) {
  const mutation = useCreateStaffEmployeeMutation(month)
  const [name, setName] = useState('')
  const [position, setPosition] = useState('')
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = createStaffEmployeeRequestSchema.safeParse({ name, position })
    if (!parsed.success) { setError('Введите имя и должность не короче двух символов.'); return }
    mutation.mutate(parsed.data, { onSuccess: ({ employee }) => { onCreated(employee.id); onOpenChange(false); setName(''); setPosition(''); setError(null) } })
  }
  return (
    <Dialog onOpenChange={(next) => { if (!next && mutation.isPending) return; onOpenChange(next) }} open={open}><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>Новый сотрудник</DialogTitle><DialogDescription>Аккаунт для входа не создаётся.</DialogDescription></DialogHeader><FieldGroup className="py-5"><Field><FieldLabel htmlFor="staff-name">Имя</FieldLabel><Input autoFocus id="staff-name" onChange={(event) => setName(event.target.value)} value={name} /></Field><Field><FieldLabel htmlFor="staff-position">Должность</FieldLabel><Input id="staff-position" onChange={(event) => setPosition(event.target.value)} value={position} /></Field>{error && <FieldError>{error}</FieldError>}{mutation.isError && <FieldError>{mutation.error.message}</FieldError>}</FieldGroup><DialogFooter><Button disabled={mutation.isPending} type="submit"><HugeiconsIcon icon={Add01Icon} />{mutation.isPending ? 'Добавляем…' : 'Добавить'}</Button></DialogFooter></form></DialogContent></Dialog>
  )
}

function CreateEventDialog({ employee, month, onOpenChange, open, type }: { employee: StaffEmployee; month: string; onOpenChange: (open: boolean) => void; open: boolean; type: StaffEventType }) {
  const mutation = useCreateStaffEventMutation(month)
  const today = new Date().toISOString().slice(0, 10)
  const [occurredOn, setOccurredOn] = useState(today.startsWith(month) ? today : `${month}-01`)
  const [arrivalTime, setArrivalTime] = useState('')
  const [fineAmount, setFineAmount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = createStaffEventRequestSchema.safeParse({
      type,
      occurredOn,
      arrivalTime: type === 'lateness' ? arrivalTime || null : null,
      fineAmount: type === 'fine' && Number(fineAmount) > 0 ? Number(fineAmount).toFixed(2) : null,
      reason,
    })
    if (!parsed.success) { setError(type === 'fine' ? 'Укажите дату, сумму штрафа и причину.' : 'Укажите дату, время прихода и причину.'); return }
    mutation.mutate({ employeeId: employee.id, input: parsed.data }, { onSuccess: () => { onOpenChange(false); setArrivalTime(''); setFineAmount(''); setReason(''); setError(null) } })
  }
  return (
    <Dialog onOpenChange={(next) => { if (!next && mutation.isPending) return; onOpenChange(next) }} open={open}><DialogContent><form onSubmit={submit}><DialogHeader><DialogTitle>{type === 'fine' ? 'Добавить штраф' : 'Записать опоздание'}</DialogTitle><DialogDescription>{employee.name}. Событие хранится как ручная запись и не удерживается из зарплаты автоматически.</DialogDescription></DialogHeader><FieldGroup className="py-5"><Field><FieldLabel htmlFor="staff-event-date">Дата</FieldLabel><Input autoFocus id="staff-event-date" onChange={(event) => setOccurredOn(event.target.value)} type="date" value={occurredOn} /></Field>{type === 'lateness' ? <Field><FieldLabel htmlFor="staff-arrival-time">Время прихода</FieldLabel><Input id="staff-arrival-time" onChange={(event) => setArrivalTime(event.target.value)} type="time" value={arrivalTime} /></Field> : <Field><FieldLabel htmlFor="staff-fine-amount">Сумма штрафа</FieldLabel><Input id="staff-fine-amount" min="1" onChange={(event) => setFineAmount(event.target.value)} step="1" type="number" value={fineAmount} /></Field>}<Field><FieldLabel htmlFor="staff-event-reason">Причина</FieldLabel><Textarea id="staff-event-reason" maxLength={500} onChange={(event) => setReason(event.target.value)} value={reason} /></Field>{error && <FieldError>{error}</FieldError>}{mutation.isError && <FieldError>{mutation.error.message}</FieldError>}</FieldGroup><DialogFooter><Button disabled={mutation.isPending} type="submit">{mutation.isPending ? 'Сохраняем…' : 'Сохранить'}</Button></DialogFooter></form></DialogContent></Dialog>
  )
}

function formatEventDate(date: string) {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`))
}
