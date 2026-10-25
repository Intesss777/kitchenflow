import {
  Alert02Icon,
  ArrowRight01Icon,
  CheckmarkSquare02Icon,
  Delete02Icon,
  Edit02Icon,
  PackageAdd01Icon,
  PackageReceiveIcon,
  PackageRemove01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  createInventoryMovementRequestSchema,
  createInventoryProductRequestSchema,
  updateInventoryProductRequestSchema,
  type InventoryMovementType,
  type InventoryOverviewResponse,
  type InventoryProduct,
  type InventoryUnit,
} from '@kitchenflow/contracts'
import { useState, type FormEvent } from 'react'

import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { quantityInputStep } from '@/platform/intl/quantity'
import { filterInventoryProducts, type InventoryFilter } from './model'
import {
  useCreateInventoryMovementMutation,
  useCreateInventoryProductMutation,
  useArchiveInventoryProductMutation,
  useInventoryProductQuery,
  useUpdateInventoryProductMutation,
} from './queries'

const units: Record<InventoryUnit, string> = {
  kilogram: 'кг',
  gram: 'г',
  liter: 'л',
  milliliter: 'мл',
  piece: 'шт.',
}
const movementLabels: Record<InventoryMovementType, string> = {
  receipt: 'Приход',
  writeoff: 'Списание',
  stocktake: 'Пересчёт',
}
const dateTimeFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function InventoryWorkspace({
  overview,
}: {
  overview: InventoryOverviewResponse
}) {
  const [filter, setFilter] = useState<InventoryFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [productDialogOpen, setProductDialogOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [movementType, setMovementType] =
    useState<InventoryMovementType | null>(null)
  const selected =
    overview.products.find((product) => product.id === selectedId) ?? null
  const canManageProducts = overview.workspace.role !== 'chef'
  const canEditCost = overview.workspace.role !== 'chef'
  const healthyProducts =
    overview.metrics.activeProducts - overview.metrics.lowStockProducts
  const filteredProducts = filterInventoryProducts(overview.products, filter)

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        <InventoryFilterCard
          active={filter === 'all'}
          label="Все позиции"
          onClick={() => setFilter('all')}
          value={overview.metrics.activeProducts}
        />
        <InventoryFilterCard
          active={filter === 'low'}
          label="Мало"
          onClick={() => setFilter('low')}
          tone="danger"
          value={overview.metrics.lowStockProducts}
        />
        <InventoryFilterCard
          active={filter === 'healthy'}
          label="В норме"
          onClick={() => setFilter('healthy')}
          tone="success"
          value={healthyProducts}
        />
      </div>

      <Card>
        <CardHeader className="grid items-start gap-3 border-b sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <CardTitle>Остатки</CardTitle>
            <CardDescription>
              {overview.workspace.branchName} · показано{' '}
              {filteredProducts.length} из {overview.products.length}
            </CardDescription>
          </div>
          {canManageProducts && (
            <div className="flex items-center gap-2">
              <Button
                className="bg-success text-success-foreground hover:bg-success/90"
                onClick={() => setProductDialogOpen(true)}
                size="sm"
              >
                <HugeiconsIcon icon={PackageAdd01Icon} />
                Добавить
              </Button>
              <Button
                onClick={() => setDeleteDialogOpen(true)}
                size="sm"
                variant="destructive"
              >
                <HugeiconsIcon icon={Delete02Icon} />
                Удалить
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {overview.products.length === 0 ? (
            <InventoryEmpty
              canAdd={canManageProducts}
              onAdd={() => setProductDialogOpen(true)}
            />
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-dashed p-7 text-center">
              <Typography tone="muted" variant="bodySm">
                В этом разделе позиций нет.
              </Typography>
              <Button
                className="mt-4"
                onClick={() => setFilter('all')}
                size="sm"
                variant="outline"
              >
                Показать все
              </Button>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Наименование</TableHead>
                      <TableHead>Категория</TableHead>
                      <TableHead>Остаток</TableHead>
                      <TableHead>Минимум</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>
                        <Typography
                          as="span"
                          className="sr-only"
                          variant="caption"
                        >
                          Действия
                        </Typography>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow
                        className="cursor-pointer transition-colors hover:bg-muted/50"
                        data-testid="inventory-row"
                        key={product.id}
                        onClick={() => setSelectedId(product.id)}
                      >
                        <TableCell>
                          <button
                            className="outline-none focus-visible:underline"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelectedId(product.id)
                            }}
                            type="button"
                          >
                            <Typography as="span" variant="bodySmMedium">
                              {product.name}
                            </Typography>
                          </button>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {product.category ?? 'Без категории'}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatQuantity(product.quantity)}{' '}
                          <span className="text-muted-foreground">
                            {units[product.unit]}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatQuantity(product.minimumQuantity)}{' '}
                          {units[product.unit]}
                        </TableCell>
                        <TableCell>
                          <InventoryStatusBadge
                            isLowStock={product.isLowStock}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 text-muted-foreground">
                            {canManageProducts && (
                              <Button
                                aria-label={`Редактировать ${product.name}`}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setEditingProduct(product)
                                }}
                                size="icon-xs"
                                variant="ghost"
                              >
                                <HugeiconsIcon icon={Edit02Icon} />
                              </Button>
                            )}
                            <HugeiconsIcon aria-hidden="true" icon={ArrowRight01Icon} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="divide-y md:hidden">
                {filteredProducts.map((product) => (
                  <div
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-4 first:pt-0 last:pb-0"
                    key={product.id}
                  >
                    <button
                      className="min-w-0 text-left outline-none focus-visible:underline"
                      onClick={() => setSelectedId(product.id)}
                      type="button"
                    >
                      <Typography as="span" truncate variant="bodySmMedium">
                        {product.name}
                      </Typography>
                      <Typography
                        as="span"
                        className="mt-1 block"
                        truncate
                        tone="muted"
                        variant="caption"
                      >
                        {product.category ?? 'Без категории'} · минимум{' '}
                        {formatQuantity(product.minimumQuantity)}{' '}
                        {units[product.unit]}
                      </Typography>
                    </button>
                    <span className="grid justify-items-end gap-1.5">
                      <Typography
                        as="span"
                        className="tabular-nums"
                        variant="bodySmMedium"
                      >
                        {formatQuantity(product.quantity)} {units[product.unit]}
                      </Typography>
                      <InventoryStatusBadge isLowStock={product.isLowStock} />
                    </span>
                    {canManageProducts && (
                      <Button
                        aria-label={`Редактировать ${product.name}`}
                        onClick={() => setEditingProduct(product)}
                        size="icon-sm"
                        variant="ghost"
                      >
                        <HugeiconsIcon icon={Edit02Icon} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null)
        }}
      >
        {selected && (
          <SheetContent>
            <SheetHeader>
              <div className="flex flex-wrap items-center gap-2 pr-8">
                <SheetTitle>{selected.name}</SheetTitle>
                {selected.isLowStock && (
                  <Badge variant="destructive">
                    <HugeiconsIcon icon={Alert02Icon} />
                    Мало
                  </Badge>
                )}
              </div>
              <SheetDescription>
                {selected.category ?? 'Без категории'} · минимум{' '}
                {formatQuantity(selected.minimumQuantity)}{' '}
                {units[selected.unit]}
              </SheetDescription>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              <InventoryDetail
                onAddMovement={setMovementType}
                product={selected}
              />
            </div>
          </SheetContent>
        )}
      </Sheet>

      <CreateProductDialog
        canEditCost={canEditCost}
        onCreated={setSelectedId}
        onOpenChange={setProductDialogOpen}
        open={productDialogOpen}
      />
      {editingProduct && (
        <EditProductDialog
          canEditCost={canEditCost}
          onOpenChange={(open) => {
            if (!open) setEditingProduct(null)
          }}
          open
          product={editingProduct}
        />
      )}
      <ArchiveProductDialog
        onOpenChange={setDeleteDialogOpen}
        open={deleteDialogOpen}
        products={overview.products}
      />
      {selected && (
        <CreateMovementDialog
          canEditCost={canEditCost}
          onOpenChange={(open) => {
            if (!open) setMovementType(null)
          }}
          open={movementType !== null}
          product={selected}
          type={movementType ?? 'receipt'}
        />
      )}
    </div>
  )
}

function InventoryFilterCard({
  active,
  label,
  onClick,
  tone = 'default',
  value,
}: {
  active: boolean
  label: string
  onClick: () => void
  tone?: 'default' | 'danger' | 'success'
  value: number
}) {
  return (
    <button
      aria-label={`${label}: ${value}`}
      aria-pressed={active}
      className={cn(
        'flex min-h-9 items-center gap-2 rounded-full border bg-card px-3 py-2 text-left shadow-xs outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50',
        active && 'border-primary bg-primary/10 text-primary ring-1 ring-primary/20',
      )}
      data-testid={`inventory-filter-${tone}`}
      onClick={onClick}
      type="button"
    >
      <Typography
        as="span"
        className={cn(
          !active && 'text-muted-foreground',
          tone === 'danger' && active && 'text-primary',
        )}
        variant="caption"
      >
        {label}
      </Typography>
      <Typography as="span" className="tabular-nums" variant="bodySmMedium">
        {value}
      </Typography>
    </button>
  )
}

function InventoryStatusBadge({ isLowStock }: { isLowStock: boolean }) {
  return (
    <Badge
      className={cn(
        isLowStock && 'border-primary/20 bg-primary/10 text-primary',
      )}
      variant="outline"
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          isLowStock ? 'bg-primary' : 'bg-muted-foreground',
        )}
      />
      {isLowStock ? 'Мало' : 'В норме'}
    </Badge>
  )
}

function InventoryEmpty({ canAdd, onAdd }: { canAdd: boolean; onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed p-7 text-center">
      <HugeiconsIcon
        className="mx-auto mb-3 text-muted-foreground"
        icon={PackageAdd01Icon}
        size={28}
      />
      <Typography as="h2" variant="h6">
        Склад пока пуст
      </Typography>
      <Typography className="mt-1" tone="muted" variant="bodySm">
        {canAdd
          ? 'Добавьте первый продукт, чтобы вести остатки и движения.'
          : 'Владелец или администратор ещё не добавил товары для этого склада.'}
      </Typography>
      {canAdd && (
        <Button className="mt-4" onClick={onAdd} size="sm">
          Добавить товар
        </Button>
      )}
    </div>
  )
}

function InventoryDetail({
  onAddMovement,
  product,
}: {
  onAddMovement: (type: InventoryMovementType) => void
  product: InventoryProduct
}) {
  const query = useInventoryProductQuery(product.id)
  return (
    <div className="grid gap-5">
      <div className="grid grid-cols-3 gap-2">
        <Button onClick={() => onAddMovement('receipt')} size="sm">
          <HugeiconsIcon icon={PackageReceiveIcon} />
          Приход
        </Button>
        <Button
          onClick={() => onAddMovement('writeoff')}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon icon={PackageRemove01Icon} />
          Списать
        </Button>
        <Button
          onClick={() => onAddMovement('stocktake')}
          size="sm"
          variant="outline"
        >
          <HugeiconsIcon icon={CheckmarkSquare02Icon} />
          Пересчёт
        </Button>
      </div>
      <div className="grid gap-3 rounded-xl bg-muted/50 p-4 sm:grid-cols-3">
        <SummaryItem
          label="Остаток"
          value={`${formatQuantity(product.quantity)} ${units[product.unit]}`}
        />
        <SummaryItem
          label="Статус"
          value={product.isLowStock ? 'Нужно заказать' : 'В норме'}
        />
        {product.unitCost !== null && (
          <SummaryItem
            label="Цена за единицу"
            value={currency.format(Number(product.unitCost))}
          />
        )}
      </div>
      <div className="grid gap-4">
        <div>
          <Typography as="h3" variant="h6">
            История движений
          </Typography>
          <Typography tone="muted" variant="bodySm">
            Последние операции по этой позиции
          </Typography>
        </div>
        {query.isPending ? (
          <div className="grid gap-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertTitle>Не удалось загрузить историю</AlertTitle>
            <AlertDescription>{query.error.message}</AlertDescription>
          </Alert>
        ) : query.data.movements.length === 0 ? (
          <div className="rounded-xl border border-dashed p-7 text-center">
            <Typography tone="muted" variant="bodySm">
              Движений по продукту пока нет.
            </Typography>
          </div>
        ) : (
          <div className="grid gap-2">
            {query.data.movements.map((movement) => (
              <div
                className="flex items-start justify-between gap-4 rounded-xl border p-4"
                key={movement.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Typography as="span" variant="bodySmMedium">
                      {movementLabels[movement.type]}
                    </Typography>
                    {movement.reference && (
                      <Badge variant="outline">{movement.reference}</Badge>
                    )}
                  </div>
                  <Typography className="mt-1" tone="muted" variant="caption">
                    {dateTimeFormatter.format(new Date(movement.occurredAt))} ·{' '}
                    {movement.createdByName}
                    {movement.note ? ` · ${movement.note}` : ''}
                  </Typography>
                </div>
                <div className="shrink-0 text-right">
                  <Typography
                    className={cn(
                      'tabular-nums',
                      Number(movement.quantityDelta) > 0 &&
                        'text-emerald-700 dark:text-emerald-400',
                    )}
                    variant="bodySmMedium"
                  >
                    {Number(movement.quantityDelta) > 0 ? '+' : ''}
                    {formatQuantity(movement.quantityDelta)}{' '}
                    {units[product.unit]}
                  </Typography>
                  <Typography tone="muted" variant="caption">
                    остаток {formatQuantity(movement.resultingQuantity)}
                  </Typography>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Typography tone="muted" variant="caption">
        {label}
      </Typography>
      <Typography className="mt-1 tabular-nums" variant="bodySmMedium">
        {value}
      </Typography>
    </div>
  )
}

function CreateProductDialog({
  canEditCost,
  onCreated,
  onOpenChange,
  open,
}: {
  canEditCost: boolean
  onCreated: (productId: string) => void
  onOpenChange: (open: boolean) => void
  open: boolean
}) {
  const mutation = useCreateInventoryProductMutation()
  const [validationError, setValidationError] = useState<string | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = createInventoryProductRequestSchema.safeParse({
      name: form.get('name'),
      category: emptyToNull(form.get('category')),
      unit: form.get('unit'),
      minimumQuantity: normalizeQuantity(
        String(form.get('minimumQuantity') ?? ''),
      ),
      unitCost: canEditCost ? normalizeMoneyOrNull(form.get('unitCost')) : null,
    })
    if (!parsed.success) {
      setValidationError('Проверьте название, единицу и минимальный остаток')
      return
    }
    setValidationError(null)
    mutation.mutate(parsed.data, {
      onSuccess: (response) => {
        onCreated(response.product.id)
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return
        mutation.reset()
        setValidationError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая позиция склада</DialogTitle>
          <DialogDescription>
            Единицу измерения и минимальный остаток можно задать для каждого
            продукта.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="product-name">Название</FieldLabel>
              <Input
                autoFocus
                id="product-name"
                name="name"
                placeholder="Например, Авокадо"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="product-category">Категория</FieldLabel>
              <Input
                id="product-category"
                name="category"
                placeholder="Овощи и зелень"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="product-unit">Единица</FieldLabel>
                <NativeSelect
                  className="w-full"
                  defaultValue="kilogram"
                  id="product-unit"
                  name="unit"
                >
                  {Object.entries(units).map(([value, label]) => (
                    <NativeSelectOption key={value} value={value}>
                      {label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field>
                <FieldLabel htmlFor="product-minimum">
                  Минимальный остаток
                </FieldLabel>
                <Input
                  defaultValue="0"
                  id="product-minimum"
                  min="0"
                  name="minimumQuantity"
                  required
                  step="0.001"
                  type="number"
                />
              </Field>
            </div>
            {canEditCost && (
              <Field>
                <FieldLabel htmlFor="product-cost">
                  Закупочная цена за единицу, ₽
                </FieldLabel>
                <Input
                  id="product-cost"
                  min="0.01"
                  name="unitCost"
                  placeholder="Необязательно"
                  step="0.01"
                  type="number"
                />
              </Field>
            )}
          </FieldGroup>
          {(validationError || mutation.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Продукт не добавлен</AlertTitle>
              <AlertDescription>
                {validationError ?? mutation.error?.message}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Добавляем…' : 'Добавить товар'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditProductDialog({
  canEditCost,
  onOpenChange,
  open,
  product,
}: {
  canEditCost: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  product: InventoryProduct
}) {
  const mutation = useUpdateInventoryProductMutation()
  const [validationError, setValidationError] = useState<string | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = updateInventoryProductRequestSchema.safeParse({
      name: form.get('name'),
      category: emptyToNull(form.get('category')),
      minimumQuantity: normalizeQuantity(String(form.get('minimumQuantity') ?? '')),
      unitCost: canEditCost ? normalizeMoneyOrNull(form.get('unitCost')) : null,
    })
    if (!parsed.success) {
      setValidationError('Проверьте название и минимальный остаток')
      return
    }
    setValidationError(null)
    mutation.mutate(
      { productId: product.id, input: parsed.data },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return
        mutation.reset()
        setValidationError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Редактировать товар</DialogTitle>
          <DialogDescription>
            Единица измерения зафиксирована, чтобы сохранить корректную историю движений.
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="edit-product-name">Название</FieldLabel>
              <Input
                autoFocus
                defaultValue={product.name}
                id="edit-product-name"
                name="name"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="edit-product-category">Категория</FieldLabel>
              <Input
                defaultValue={product.category ?? ''}
                id="edit-product-category"
                name="category"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="edit-product-unit">Единица</FieldLabel>
                <Input
                  disabled
                  id="edit-product-unit"
                  value={units[product.unit]}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="edit-product-minimum">Минимальный остаток</FieldLabel>
                <Input
                  defaultValue={formatQuantity(product.minimumQuantity)}
                  id="edit-product-minimum"
                  min="0"
                  name="minimumQuantity"
                  required
                  step="0.001"
                  type="number"
                />
              </Field>
            </div>
            {canEditCost && (
              <Field>
                <FieldLabel htmlFor="edit-product-cost">
                  Закупочная цена за единицу, ₽
                </FieldLabel>
                <Input
                  defaultValue={product.unitCost ? Number(product.unitCost) : ''}
                  id="edit-product-cost"
                  min="0.01"
                  name="unitCost"
                  placeholder="Необязательно"
                  step="0.01"
                  type="number"
                />
              </Field>
            )}
          </FieldGroup>
          {(validationError || mutation.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Изменения не сохранены</AlertTitle>
              <AlertDescription>
                {validationError ?? mutation.error?.message}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Сохраняем…' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ArchiveProductDialog({
  onOpenChange,
  open,
  products,
}: {
  onOpenChange: (open: boolean) => void
  open: boolean
  products: InventoryProduct[]
}) {
  const mutation = useArchiveInventoryProductMutation()
  const [productId, setProductId] = useState('')
  const selected = products.find((product) => product.id === productId) ?? null

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return
        if (!next) {
          mutation.reset()
          setProductId('')
        }
        onOpenChange(next)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить товар со склада?</AlertDialogTitle>
          <AlertDialogDescription>
            Выберите товар. Он исчезнет из рабочих списков, но история операций сохранится.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="archive-product">Товар</FieldLabel>
          <NativeSelect
            className="w-full"
            id="archive-product"
            onChange={(event) => setProductId(event.target.value)}
            value={productId}
          >
            <NativeSelectOption value="">Выберите товар</NativeSelectOption>
            {products.map((product) => (
              <NativeSelectOption key={product.id} value={product.id}>
                {product.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        {selected && (
          <Typography tone="muted" variant="caption">
            Остаток: {formatQuantity(selected.quantity)} {units[selected.unit]}
          </Typography>
        )}
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertTitle>Товар не удалён</AlertTitle>
            <AlertDescription>{mutation.error.message}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Отмена</AlertDialogCancel>
          <Button
            disabled={!selected || mutation.isPending}
            onClick={() => {
              if (!selected) return
              mutation.mutate(selected.id, {
                onSuccess: () => {
                  mutation.reset()
                  setProductId('')
                  onOpenChange(false)
                },
              })
            }}
            variant="destructive"
          >
            {mutation.isPending ? 'Удаляем…' : 'Удалить товар'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function CreateMovementDialog({
  canEditCost,
  onOpenChange,
  open,
  product,
  type,
}: {
  canEditCost: boolean
  onOpenChange: (open: boolean) => void
  open: boolean
  product: InventoryProduct
  type: InventoryMovementType
}) {
  const mutation = useCreateInventoryMovementMutation()
  const [validationError, setValidationError] = useState<string | null>(null)
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = createInventoryMovementRequestSchema.safeParse({
      type,
      quantity: normalizeQuantity(String(form.get('quantity') ?? '')),
      unitCost:
        canEditCost && type === 'receipt'
          ? normalizeMoneyOrNull(form.get('unitCost'))
          : null,
      occurredAt: localDateTimeToIso(String(form.get('occurredAt'))),
      reference: emptyToNull(form.get('reference')),
      note: emptyToNull(form.get('note')),
    })
    if (!parsed.success) {
      setValidationError('Проверьте количество и дату операции')
      return
    }
    setValidationError(null)
    mutation.mutate(
      { productId: product.id, input: parsed.data },
      {
        onSuccess: () => onOpenChange(false),
      },
    )
  }
  const title =
    type === 'receipt'
      ? 'Принять на склад'
      : type === 'writeoff'
        ? 'Списать со склада'
        : 'Зафиксировать пересчёт'
  const quantityLabel =
    type === 'stocktake' ? 'Фактический остаток' : 'Количество'
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && mutation.isPending) return
        mutation.reset()
        setValidationError(null)
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {product.name} · сейчас {formatQuantity(product.quantity)}{' '}
            {units[product.unit]}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-5" onSubmit={submit}>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="movement-quantity">
                  {quantityLabel}, {units[product.unit]}
                </FieldLabel>
                <Input
                  autoFocus
                  id="movement-quantity"
                  min={
                    type === 'stocktake' ? '0' : quantityInputStep(product.unit)
                  }
                  name="quantity"
                  required
                  step={quantityInputStep(product.unit)}
                  type="number"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="movement-date">Дата и время</FieldLabel>
                <Input
                  defaultValue={dateTimeToInputValue(new Date())}
                  id="movement-date"
                  name="occurredAt"
                  required
                  type="datetime-local"
                />
              </Field>
            </div>
            {type === 'receipt' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="movement-reference">
                    Накладная
                  </FieldLabel>
                  <Input
                    id="movement-reference"
                    name="reference"
                    placeholder="Номер документа"
                  />
                </Field>
                {canEditCost && (
                  <Field>
                    <FieldLabel htmlFor="movement-cost">
                      Цена за единицу, ₽
                    </FieldLabel>
                    <Input
                      id="movement-cost"
                      min="0.01"
                      name="unitCost"
                      placeholder="Необязательно"
                      step="0.01"
                      type="number"
                    />
                  </Field>
                )}
              </div>
            )}
            <Field>
              <FieldLabel htmlFor="movement-note">Комментарий</FieldLabel>
              <Input
                id="movement-note"
                name="note"
                placeholder={
                  type === 'stocktake'
                    ? 'Например, вечерний пересчёт'
                    : 'Необязательно'
                }
              />
            </Field>
          </FieldGroup>
          {(validationError || mutation.isError) && (
            <Alert variant="destructive">
              <AlertTitle>Операция не сохранена</AlertTitle>
              <AlertDescription>
                {validationError ?? mutation.error?.message}
              </AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button disabled={mutation.isPending} type="submit">
              {mutation.isPending ? 'Сохраняем…' : movementLabels[type]}
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

function normalizeQuantity(value: string) {
  const quantity = Number(value.replace(',', '.'))
  return Number.isFinite(quantity) ? quantity.toFixed(3) : value
}

function normalizeMoneyOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return null
  const amount = Number(text.replace(',', '.'))
  return Number.isFinite(amount) ? amount.toFixed(2) : text
}

function localDateTimeToIso(value: string) {
  return new Date(value).toISOString()
}

function dateTimeToInputValue(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 3 }).format(
    Number(value),
  )
}
