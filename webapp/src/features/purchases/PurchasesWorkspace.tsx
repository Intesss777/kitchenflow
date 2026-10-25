import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Delete02Icon,
  MinusSignIcon,
  SentIcon,
  ShoppingBasket01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type {
  PreparePurchaseMessageResponse,
  PurchaseDraftProduct,
  PurchaseDraftResponse,
} from '@kitchenflow/contracts'
import { useMemo, useState } from 'react'

import { CompactMetrics } from '@/components/dashboard'
import { Typography } from '@/components/typography'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { quantityInputStep } from '@/platform/intl/quantity'
import {
  adjustPurchaseQuantity,
  initialPurchaseItems,
  isPurchaseQuantityInput,
  normalizeManualPurchaseQuantity,
  parsePurchaseQuantity,
  purchaseDraftInput,
  suggestedPurchaseQuantity,
  updatePurchaseItem,
  type EditablePurchaseItem,
} from './model'
import {
  usePreparePurchaseMessageMutation,
  useSavePurchaseDraftMutation,
} from './queries'

const units: Record<PurchaseDraftProduct['unit'], string> = {
  kilogram: 'кг',
  gram: 'г',
  liter: 'л',
  milliliter: 'мл',
  piece: 'шт.',
}
const currency = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

export function PurchasesWorkspace({
  draft,
}: {
  draft: PurchaseDraftResponse
}) {
  const [note, setNote] = useState(draft.note ?? '')
  const [items, setItems] = useState<EditablePurchaseItem[]>(() =>
    initialPurchaseItems(draft),
  )
  const [prepared, setPrepared] =
    useState<PreparePurchaseMessageResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [includePrices, setIncludePrices] = useState(false)
  const save = useSavePurchaseDraftMutation()
  const prepare = usePreparePurchaseMessageMutation()
  const productsById = useMemo(
    () => new Map(draft.products.map((product) => [product.id, product])),
    [draft.products],
  )
  const orderedProducts = useMemo(
    () =>
      [...draft.products].sort(
        (left, right) =>
          Number(right.isLowStock) - Number(left.isLowStock) ||
          left.name.localeCompare(right.name, 'ru'),
      ),
    [draft.products],
  )
  const selectedIds = new Set(items.map((item) => item.productId))
  const currentInput = () => purchaseDraftInput(note, items)
  const persist = (
    nextItems = items,
    nextNote = note,
  ) => {
    save.mutate(purchaseDraftInput(nextNote, nextItems))
  }

  const estimatedTotal =
    draft.workspace.role === 'chef'
      ? null
      : items.reduce((total, item) => {
          const product = productsById.get(item.productId)
          return (
            total +
            (parsePurchaseQuantity(item.requestedQuantity) ?? 0) *
              Number(product?.unitCost ?? 0)
          )
        }, 0)
  const quantitiesValid = items.every(
    (item) => parsePurchaseQuantity(item.requestedQuantity) !== null,
  )

  const metrics = [
    {
      label: 'В списке',
      value: items.length,
      description: `Филиал: ${draft.workspace.branchName}`,
    },
    {
      label: 'Заканчиваются',
      value: draft.metrics.lowStockCount,
      description: 'По минимальному остатку.',
    },
    ...(estimatedTotal === null
      ? []
      : [
          {
            label: 'Ориентировочно',
            value: currency.format(estimatedTotal),
            description: 'По последним закупочным ценам.',
          },
        ]),
  ]

  function addProduct(product: PurchaseDraftProduct) {
    const next = updatePurchaseItem(
      items,
      product.id,
      suggestedPurchaseQuantity(product),
    )
    setItems(next)
    persist(next)
  }

  function removeProduct(productId: string) {
    const next = items.filter((item) => item.productId !== productId)
    setItems(next)
    persist(next)
  }

  function changeQuantity(productId: string, value: string) {
    if (!isPurchaseQuantityInput(value)) return
    setItems(updatePurchaseItem(items, productId, value))
  }

  function commitQuantity(item: EditablePurchaseItem) {
    const normalized =
      normalizeManualPurchaseQuantity(item.requestedQuantity) ?? '1'
    const next = updatePurchaseItem(items, item.productId, normalized)
    setItems(next)
    persist(next)
  }

  function stepQuantity(item: EditablePurchaseItem, delta: number) {
    const product = productsById.get(item.productId)
    if (!product) return
    const next = updatePurchaseItem(
      items,
      item.productId,
      adjustPurchaseQuantity(
        item.requestedQuantity,
        product.unit,
        delta < 0 ? -1 : 1,
      ),
    )
    setItems(next)
    persist(next)
  }

  return (
    <div className="grid gap-5">
      <CompactMetrics items={metrics} />
      {(save.isError || prepare.isError) && (
        <Alert variant="destructive">
          <AlertTitle>Не удалось сохранить закупку</AlertTitle>
          <AlertDescription>
            {save.error?.message ?? prepare.error?.message}
          </AlertDescription>
        </Alert>
      )}
      <Tabs defaultValue="products">
        <TabsList className="grid w-full grid-cols-2 lg:hidden">
          <TabsTrigger value="products">Продукты</TabsTrigger>
          <TabsTrigger value="purchase">
            Закупка
            <Badge variant="secondary">{items.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <TabsContent
            className="mt-4 data-[state=inactive]:hidden lg:mt-0 lg:data-[state=inactive]:block"
            forceMount
            value="products"
          >
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Продукты на складе</CardTitle>
                <CardDescription>
                  Сначала показаны позиции ниже минимального остатка.
                </CardDescription>
              </CardHeader>
              <CardContent className="divide-y">
                {orderedProducts.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <Typography tone="muted" variant="bodySm">
                      На складе пока нет товаров для закупки.
                    </Typography>
                  </div>
                ) : orderedProducts.map((product) => (
                  <div
                    className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
                    key={product.id}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Typography as="span" truncate variant="bodySmMedium">
                          {product.name}
                        </Typography>
                        {product.isLowStock && (
                          <Badge
                            className="border-primary/20 bg-primary/10 text-primary"
                            variant="outline"
                          >
                            Мало
                          </Badge>
                        )}
                      </div>
                      <Typography
                        className="mt-1"
                        tone="muted"
                        variant="caption"
                      >
                        Остаток {displayQuantity(product.currentQuantity)}{' '}
                        {units[product.unit]} · минимум{' '}
                        {displayQuantity(product.minimumQuantity)}{' '}
                        {units[product.unit]}
                      </Typography>
                    </div>
                    <Button
                      aria-label={`Добавить ${product.name}`}
                      disabled={selectedIds.has(product.id)}
                      onClick={() => addProduct(product)}
                      size="icon-sm"
                      variant={
                        selectedIds.has(product.id) ? 'secondary' : 'outline'
                      }
                    >
                      <HugeiconsIcon
                        icon={
                          selectedIds.has(product.id)
                            ? CheckmarkCircle02Icon
                            : Add01Icon
                        }
                      />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent
            className="mt-4 data-[state=inactive]:hidden lg:sticky lg:top-6 lg:mt-0 lg:data-[state=inactive]:block xl:top-23"
            forceMount
            value="purchase"
          >
            <Card>
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle>Список закупки</CardTitle>
                    <CardDescription>Общий черновик филиала</CardDescription>
                  </div>
                  <HugeiconsIcon
                    className="text-muted-foreground"
                    icon={ShoppingBasket01Icon}
                    size={24}
                  />
                </div>
              </CardHeader>
              <CardContent className="grid gap-5">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-6 text-center">
                    <Typography tone="muted" variant="bodySm">
                      Нажмите плюс у нужных продуктов.
                    </Typography>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {items.map((item) => {
                      const product = productsById.get(item.productId)
                      if (!product) return null
                      return (
                        <div
                          className="grid gap-3 rounded-xl bg-muted/55 p-3"
                          key={item.productId}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <Typography
                              as="span"
                              truncate
                              variant="bodySmMedium"
                            >
                              {product.name}
                            </Typography>
                            <Button
                              aria-label={`Удалить ${product.name}`}
                              onClick={() => removeProduct(product.id)}
                              size="icon-xs"
                              variant="ghost"
                            >
                              <HugeiconsIcon icon={Delete02Icon} />
                            </Button>
                          </div>
                          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2">
                            <Button
                              aria-label={`Уменьшить ${product.name} на единицу`}
                              onClick={() => stepQuantity(item, -1)}
                              size="icon-sm"
                              variant="outline"
                            >
                              <HugeiconsIcon icon={MinusSignIcon} />
                            </Button>
                            <Input
                              aria-label={`Количество ${product.name}`}
                              disabled={prepare.isPending}
                              inputMode="decimal"
                              min={quantityInputStep(product.unit)}
                              maxLength={15}
                              onBlur={() => commitQuantity(item)}
                              onChange={(event) =>
                                changeQuantity(product.id, event.target.value)
                              }
                              step={quantityInputStep(product.unit)}
                              type="number"
                              value={item.requestedQuantity}
                            />
                            <Typography as="span" tone="muted" variant="bodySm">
                              {units[product.unit]}
                            </Typography>
                            <Button
                              aria-label={`Увеличить ${product.name} на единицу`}
                              onClick={() => stepQuantity(item, 1)}
                              size="icon-sm"
                              variant="outline"
                            >
                              <HugeiconsIcon icon={Add01Icon} />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <Field>
                  <FieldLabel htmlFor="purchase-note">
                    Комментарий закупщику
                  </FieldLabel>
                  <Textarea
                    disabled={prepare.isPending}
                    id="purchase-note"
                    maxLength={500}
                    onBlur={() => persist(items, note)}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Например: доставить до 10:00"
                    value={note}
                  />
                </Field>

                {estimatedTotal !== null && items.length > 0 && (
                  <div className="flex items-center justify-between rounded-xl bg-muted p-4">
                    <Typography tone="muted" variant="bodySm">
                      Ориентировочная сумма
                    </Typography>
                    <Typography className="tabular-nums" variant="bodySmMedium">
                      {currency.format(estimatedTotal)}
                    </Typography>
                  </div>
                )}
                {estimatedTotal !== null && items.length > 0 && (
                  <label className="flex items-center gap-3 rounded-xl border p-3">
                    <Checkbox
                      checked={includePrices}
                      disabled={prepare.isPending}
                      onCheckedChange={(checked) =>
                        setIncludePrices(checked === true)
                      }
                    />
                    <Typography as="span" variant="bodySmMedium">
                      Добавить прошлые цены для сверки
                    </Typography>
                  </label>
                )}
                <Button
                  disabled={
                    items.length === 0 ||
                    !quantitiesValid ||
                    prepare.isPending
                  }
                  onClick={() =>
                    prepare.mutate(
                      { ...currentInput(), includePrices },
                      { onSuccess: setPrepared },
                    )
                  }
                >
                  <HugeiconsIcon icon={SentIcon} />
                  {prepare.isPending
                    ? 'Готовим сообщение…'
                    : 'Подготовить для WhatsApp'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setPrepared(null)
            setCopied(false)
            setCopyError(null)
          }
        }}
        open={prepared !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сообщение для закупщика</DialogTitle>
            <DialogDescription>
              Проверьте список. Отправка произойдёт только после подтверждения в
              WhatsApp.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Подготовленное сообщение"
            className="min-h-56"
            readOnly
            value={prepared?.message ?? ''}
          />
          {copyError && (
            <Alert variant="destructive">
              <AlertTitle>Сообщение не скопировано</AlertTitle>
              <AlertDescription>{copyError}</AlertDescription>
            </Alert>
          )}
          <DialogFooter className="sm:justify-between">
            <Button
              onClick={() => {
                if (!prepared) return
                if (!navigator.clipboard) {
                  setCopyError('Разрешите доступ к буферу обмена и попробуйте ещё раз.')
                  return
                }
                setCopyError(null)
                void navigator.clipboard.writeText(prepared.message).then(
                  () => setCopied(true),
                  () => setCopyError('Разрешите доступ к буферу обмена и попробуйте ещё раз.'),
                )
              }}
              variant="outline"
            >
              <HugeiconsIcon icon={Copy01Icon} />
              {copied ? 'Скопировано' : 'Скопировать'}
            </Button>
            {prepared?.whatsappUrl && (
              <Button asChild>
                <a href={prepared.whatsappUrl} rel="noreferrer" target="_blank">
                  <HugeiconsIcon icon={SentIcon} />
                  <Typography asChild variant="control">
                    <span>Открыть WhatsApp</span>
                  </Typography>
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function displayQuantity(value: string) {
  return Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 3 })
}
