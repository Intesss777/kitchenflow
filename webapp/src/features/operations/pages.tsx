import { PlusSignIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SupplierWorkspace } from './SupplierWorkspace'
import { useOperationsDashboardQuery } from './queries'

export function SuppliersPage() {
  const query = useOperationsDashboardQuery()

  return (
    <PageContainer>
      <PageHeader title="Поставщики" />
      {query.isPending ? (
        <div aria-label="Загрузка поставщиков" className="grid gap-6" role="status">
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-36 rounded-4xl" />
            <Skeleton className="h-36 rounded-4xl" />
            <Skeleton className="h-36 rounded-4xl" />
          </div>
          <Skeleton className="h-[520px] rounded-4xl" />
        </div>
      ) : query.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Не удалось загрузить поставщиков</AlertTitle>
          <AlertDescription>{query.error.message}</AlertDescription>
          <AlertAction><Button onClick={() => void query.refetch()} size="sm" variant="outline"><HugeiconsIcon icon={PlusSignIcon} />Повторить</Button></AlertAction>
        </Alert>
      ) : (
        <SupplierWorkspace dashboard={query.data} />
      )}
    </PageContainer>
  )
}
