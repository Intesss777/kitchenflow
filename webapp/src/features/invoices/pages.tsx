import { CameraAdd02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import type { PurchaseInvoiceListQuery } from '@kitchenflow/contracts'
import { useState } from 'react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { InvoiceWorkspace } from './InvoiceWorkspace'
import { usePurchaseInvoicesQuery } from './queries'

export function InvoicesPage() {
  const [filters, setFilters] = useState<PurchaseInvoiceListQuery>(() => todayInvoiceQuery())
  const query = usePurchaseInvoicesQuery(filters)
  return (
    <PageContainer>
      <PageHeader title="Накладные" />
      {query.isPending ? (
        <div className="grid gap-6"><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /></div><Skeleton className="h-[560px] rounded-4xl" /></div>
      ) : query.isError ? (
        <Alert variant="destructive"><AlertTitle>Не удалось загрузить накладные</AlertTitle><AlertDescription>{query.error.message}</AlertDescription><AlertAction><Button onClick={() => void query.refetch()} size="sm" variant="outline"><HugeiconsIcon icon={CameraAdd02Icon} />Повторить</Button></AlertAction></Alert>
      ) : <InvoiceWorkspace data={query.data} filters={filters} onFiltersChange={setFilters} />}
    </PageContainer>
  )
}

function todayInvoiceQuery(): PurchaseInvoiceListQuery {
  const value = new Date()
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000)
  const today = local.toISOString().slice(0, 10)
  return { from: today, to: today, page: 1, pageSize: 200 }
}
