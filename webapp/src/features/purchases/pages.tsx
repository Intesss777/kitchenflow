import { ShoppingBasket01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PurchasesWorkspace } from './PurchasesWorkspace'
import { usePurchaseDraftQuery } from './queries'

export function PurchasesPage() {
  const query = usePurchaseDraftQuery()
  return (
    <PageContainer>
      <PageHeader title="Закупка" />
      {query.isPending ? (
        <div aria-label="Загрузка закупки" className="grid gap-6" role="status">
          <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /></div>
          <Skeleton className="h-[520px] rounded-4xl" />
        </div>
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить закупку</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
          <AlertAction><Button onClick={() => void query.refetch()} size="sm" variant="outline"><HugeiconsIcon icon={ShoppingBasket01Icon} />Повторить</Button></AlertAction>
        </Alert>
      ) : (
        <PurchasesWorkspace draft={query.data} />
      )}
    </PageContainer>
  )
}
