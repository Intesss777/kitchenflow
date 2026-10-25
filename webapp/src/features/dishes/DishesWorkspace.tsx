import {
  Add01Icon,
  CameraAdd02Icon,
  Delete02Icon,
  Dish02Icon,
  Edit02Icon,
  ImageNotFound01Icon,
  PrinterIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  saveDishCardRequestSchema,
  type DishCard,
  type DishCardsOverviewResponse,
  type InventoryUnit,
} from '@kitchenflow/contracts'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'

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
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { cn } from '@/lib/utils'
import { useSaveDishCardMutation, useUploadDishPhotoMutation } from './queries'

const units: Record<InventoryUnit, string> = {
  kilogram: 'кг', gram: 'г', liter: 'л', milliliter: 'мл', piece: 'шт.',
}
const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency', currency: 'RUB', maximumFractionDigits: 0,
})

export function DishesWorkspace({ data }: { data: DishCardsOverviewResponse }) {
  const [selectedId, setSelectedId] = useState<string | null>(data.dishes[0]?.id ?? null)
  const [editor, setEditor] = useState<DishCard | 'new' | null>(null)
  const selected = data.dishes.find((dish) => dish.id === selectedId) ?? data.dishes[0] ?? null
  const isOwner = data.workspace.role === 'owner' || data.workspace.role === 'administrator'
  const printDishCards = () => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    const finishPrinting = () => {
      document.body.classList.remove('dish-printing')
      if (wasDark) root.classList.add('dark')
      window.removeEventListener('afterprint', finishPrinting)
    }

    document.body.classList.add('dish-printing')
    if (wasDark) root.classList.remove('dark')
    window.addEventListener('afterprint', finishPrinting, { once: true })
    try {
      window.print()
    } catch (error) {
      finishPrinting()
      throw error
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 rounded-3xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><Typography as="h2" variant="h5">Рабочий справочник кухни</Typography><Typography className="mt-1" tone="muted" variant="bodySm">Без длинных рецептов и лишних учебных разделов.</Typography></div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button disabled={!data.dishes.length} onClick={printDishCards} variant="outline"><HugeiconsIcon icon={PrinterIcon} />Печать / PDF</Button>
          <Button onClick={() => setEditor('new')}><HugeiconsIcon icon={Add01Icon} />Добавить блюдо</Button>
        </div>
      </div>

      {data.dishes.length === 0 ? (
        <Card><CardContent className="grid min-h-80 place-items-center p-8 text-center"><div><HugeiconsIcon className="mx-auto text-muted-foreground" icon={Dish02Icon} size={40} /><Typography as="h2" className="mt-4" variant="h5">Добавьте первое блюдо</Typography><Typography className="mt-2" tone="muted" variant="bodySm">Достаточно названия и одного ингредиента.</Typography><Button className="mt-5" onClick={() => setEditor('new')}>Добавить блюдо</Button></div></CardContent></Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,.85fr)] xl:items-start">
          <div className="grid gap-4 sm:grid-cols-2">
            {data.dishes.map((dish) => <DishTile active={dish.id === selected?.id} dish={dish} key={dish.id} onSelect={() => setSelectedId(dish.id)} />)}
          </div>
          {selected && <DishDetail dish={selected} isOwner={isOwner} onEdit={() => setEditor(selected)} />}
        </div>
      )}

      {editor !== null && <DishEditor
        data={data}
        dish={editor === 'new' ? null : editor}
        isOwner={isOwner}
        key={editor === 'new' ? 'new' : editor.id}
        onOpenChange={(open) => { if (!open) setEditor(null) }}
        onSaved={(dishId) => { setSelectedId(dishId); setEditor(null) }}
        open
      />}
      <DishPrintSheet data={data} />
    </div>
  )
}

function DishPrintSheet({ data }: { data: DishCardsOverviewResponse }) {
  return createPortal(
    <main className="hidden bg-background text-foreground" data-dish-print-sheet>
      <header className="mb-6 border-b pb-4">
        <Typography as="h1" variant="h3">Карты блюд</Typography>
        <Typography className="mt-1" tone="muted" variant="bodySm">{data.workspace.branchName}</Typography>
      </header>
      <div className="grid grid-cols-2 gap-6">
        {data.dishes.map((dish) => (
          <section className="dish-print-card border-t pt-3" key={dish.id}>
            <Typography as="h2" variant="h5">{dish.name}</Typography>
            <div className="mt-3 grid gap-1.5">
              {dish.ingredients.map((ingredient) => (
                <div className="flex items-baseline justify-between gap-4 border-b pb-1.5" key={ingredient.id}>
                  <Typography variant="bodySm">{ingredient.name}</Typography>
                  <Typography className="shrink-0 tabular-nums" variant="bodySmMedium">{formatIngredient(ingredient.quantity, ingredient.unit)}</Typography>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>,
    document.body,
  )
}

function DishTile({ active, dish, onSelect }: { active: boolean; dish: DishCard; onSelect: () => void }) {
  return (
    <button className={cn('overflow-hidden rounded-3xl border bg-card text-left transition hover:-translate-y-0.5 hover:shadow-md', active && 'border-primary/50 ring-2 ring-primary/10')} onClick={onSelect} type="button">
      <DishImage dish={dish} className="aspect-video w-full" />
      <div className="grid gap-2 p-5"><span className="flex items-start justify-between gap-3"><Typography as="span" variant="h6">{dish.name}</Typography>{dish.category && <Badge variant="outline">{dish.category}</Badge>}</span><Typography tone="muted" variant="bodySm">{dish.ingredients.length} {ingredientWord(dish.ingredients.length)}</Typography></div>
    </button>
  )
}

function DishDetail({ dish, isOwner, onEdit }: { dish: DishCard; isOwner: boolean; onEdit: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const photoMutation = useUploadDishPhotoMutation()
  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) photoMutation.mutate({ dishId: dish.id, file })
  }
  return (
    <Card className="overflow-hidden xl:sticky xl:top-6">
        <DishImage dish={dish} className="aspect-video w-full" />
        <CardHeader className="gap-4"><div className="flex items-start justify-between gap-4"><div><CardTitle>{dish.name}</CardTitle><CardDescription>{dish.category ?? 'Без категории'}</CardDescription></div><Button onClick={onEdit} size="sm" variant="outline"><HugeiconsIcon icon={Edit02Icon} />Изменить</Button></div><div className="flex flex-wrap gap-2"><input accept="image/jpeg,image/png,image/heic,image/heif" aria-label="Фото блюда" capture="environment" className="sr-only" onChange={pickPhoto} ref={inputRef} type="file" /><Button disabled={photoMutation.isPending} onClick={() => inputRef.current?.click()} size="sm" type="button" variant="secondary"><HugeiconsIcon icon={CameraAdd02Icon} />{photoMutation.isPending ? 'Загружаем…' : dish.photoUrl ? 'Заменить фото' : 'Добавить фото'}</Button></div>{photoMutation.isError && <Alert variant="destructive"><AlertTitle>Фото не загружено</AlertTitle><AlertDescription>{photoMutation.error.message}</AlertDescription></Alert>}</CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2"><Typography as="h3" variant="h6">Состав и граммовка</Typography>{dish.ingredients.map((ingredient) => <div className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3" key={ingredient.id}><Typography variant="bodySmMedium">{ingredient.name}</Typography><Typography className="shrink-0 tabular-nums" tone="muted" variant="bodySm">{formatIngredient(ingredient.quantity, ingredient.unit)}</Typography></div>)}</div>
        {isOwner && dish.costPrice !== null && <div className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/60 p-4"><MoneyItem label="Себестоимость" value={dish.costPrice} /><MoneyItem label="Цена" value={dish.sellingPrice} /><MoneyItem label="Маржа" value={dish.marginAmount} /></div>}
      </CardContent>
    </Card>
  )
}

function DishImage({ className, dish }: { className: string; dish: DishCard }) {
  return dish.photoUrl
    ? <img alt={dish.name} className={cn(className, 'bg-muted object-cover')} src={dish.photoUrl} />
    : <div className={cn(className, 'grid place-items-center bg-muted')}><div className="text-center"><HugeiconsIcon className="mx-auto text-muted-foreground" icon={ImageNotFound01Icon} size={32} /><Typography className="mt-2" tone="muted" variant="caption">Фото пока не добавлено</Typography></div></div>
}

function DishEditor({ data, dish, isOwner, onOpenChange, onSaved, open }: {
  data: DishCardsOverviewResponse
  dish: DishCard | null
  isOwner: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (dishId: string) => void
  open: boolean
}) {
  const mutation = useSaveDishCardMutation()
  const [name, setName] = useState(dish?.name ?? '')
  const [category, setCategory] = useState(dish?.category ?? '')
  const [sellingPrice, setSellingPrice] = useState(dish?.sellingPrice ? String(Number(dish.sellingPrice)) : '')
  const [lines, setLines] = useState<Array<{ key: string; productId: string; quantity: string }>>(
    dish?.ingredients.map((ingredient) => ({ key: ingredient.id, productId: ingredient.productId, quantity: String(Number(ingredient.quantity)) }))
      ?? [{ key: crypto.randomUUID(), productId: data.products[0]?.id ?? '', quantity: '0.100' }],
  )
  const [validationError, setValidationError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const parsed = saveDishCardRequestSchema.safeParse({
      name,
      category: category.trim() || null,
      sellingPrice: isOwner && sellingPrice ? normalizeMoney(sellingPrice) : dish?.sellingPrice ?? null,
      ingredients: lines.map((line) => ({ productId: line.productId, quantity: normalizeQuantity(line.quantity) })),
    })
    if (!parsed.success) { setValidationError('Проверьте название, ингредиенты и количество. Один продукт нельзя добавить дважды.'); return }
    setValidationError(null)
    mutation.mutate({ dishId: dish?.id ?? null, input: parsed.data }, { onSuccess: (response) => onSaved(response.dish.id) })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && mutation.isPending) return; onOpenChange(next) }}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{dish ? 'Изменить карточку' : 'Новое блюдо'}</DialogTitle><DialogDescription>Только данные, которые повар должен увидеть с первого взгляда.</DialogDescription></DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="dish-name">Название</FieldLabel><Input autoFocus id="dish-name" onChange={(event) => setName(event.target.value)} placeholder="Например, Лосось с брокколини" required value={name} /></Field><Field><FieldLabel htmlFor="dish-category">Категория</FieldLabel><Input id="dish-category" onChange={(event) => setCategory(event.target.value)} placeholder="Горячее" value={category} /></Field></div>
          {isOwner && <Field><FieldLabel htmlFor="dish-price">Цена продажи, ₽</FieldLabel><Input id="dish-price" min="0.01" onChange={(event) => setSellingPrice(event.target.value)} placeholder="Необязательно" step="0.01" type="number" value={sellingPrice} /></Field>}
          <div className="grid gap-3"><div className="flex items-center justify-between gap-3"><div><Typography as="h3" variant="h6">Ингредиенты</Typography><Typography tone="muted" variant="caption">Количество указывается в складской единице</Typography></div><Button disabled={!data.products.length || lines.length >= 30} onClick={() => setLines((current) => [...current, { key: crypto.randomUUID(), productId: data.products[0]?.id ?? '', quantity: '0.100' }])} size="sm" type="button" variant="outline"><HugeiconsIcon icon={Add01Icon} />Добавить</Button></div>
            {lines.map((line, index) => {
              const product = data.products.find((item) => item.id === line.productId)
              return <div className="grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_140px_auto] sm:items-end" key={line.key}><Field><FieldLabel htmlFor={`dish-product-${line.key}`}>Продукт</FieldLabel><NativeSelect className="w-full" id={`dish-product-${line.key}`} onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value } : item))} value={line.productId}>{data.products.map((item) => <NativeSelectOption key={item.id} value={item.id}>{item.name}</NativeSelectOption>)}</NativeSelect></Field><Field><FieldLabel htmlFor={`dish-quantity-${line.key}`}>Количество, {product ? units[product.unit] : 'ед.'}</FieldLabel><Input id={`dish-quantity-${line.key}`} min="0.001" onChange={(event) => setLines((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))} required step="0.001" type="number" value={line.quantity} /></Field><Button aria-label="Удалить ингредиент" disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, itemIndex) => itemIndex !== index))} size="icon" type="button" variant="ghost"><HugeiconsIcon icon={Delete02Icon} /></Button></div>
            })}
          </div>
          {(validationError || mutation.isError) && <Alert variant="destructive"><AlertTitle>Карточка не сохранена</AlertTitle><AlertDescription>{validationError ?? mutation.error?.message}</AlertDescription></Alert>}
          <DialogFooter><Button disabled={mutation.isPending || !data.products.length} type="submit">{mutation.isPending ? 'Сохраняем…' : 'Сохранить карточку'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function MoneyItem({ label, value }: { label: string; value: string | null }) {
  return <div><Typography tone="muted" variant="caption">{label}</Typography><Typography className="mt-1 tabular-nums" variant="bodySmMedium">{value ? currency.format(Number(value)) : '—'}</Typography></div>
}

function formatIngredient(value: string, unit: InventoryUnit) {
  const number = Number(value)
  if (unit === 'kilogram' && number < 1) return `${Math.round(number * 1000)} г`
  if (unit === 'liter' && number < 1) return `${Math.round(number * 1000)} мл`
  return `${number.toLocaleString('ru-RU', { maximumFractionDigits: 3 })} ${units[unit]}`
}

function ingredientWord(count: number) {
  const remainder = count % 100
  if (remainder >= 11 && remainder <= 14) return 'ингредиентов'
  if (count % 10 === 1) return 'ингредиент'
  if (count % 10 >= 2 && count % 10 <= 4) return 'ингредиента'
  return 'ингредиентов'
}

function normalizeQuantity(value: string) {
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number.toFixed(3) : value
}

function normalizeMoney(value: string) {
  const number = Number(value.replace(',', '.'))
  return Number.isFinite(number) ? number.toFixed(2) : value
}
