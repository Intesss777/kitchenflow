import { Dish02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DishesWorkspace } from './DishesWorkspace'
import { useDishCardsQuery } from './queries'

export function DishesPage() {
  const query = useDishCardsQuery()
  return (
    <PageContainer>
      <PageHeader title="Карты блюд" />
      {query.isPending ? (
        <div aria-label="Загрузка карт блюд" className="grid gap-6" role="status"><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /></div><Skeleton className="h-[560px] rounded-4xl" /></div>
      ) : query.isError ? (
        <Alert variant="destructive"><AlertTitle>Не удалось загрузить карты блюд</AlertTitle><AlertDescription>{query.error.message}</AlertDescription><AlertAction><Button onClick={() => void query.refetch()} size="sm" variant="outline"><HugeiconsIcon icon={Dish02Icon} />Повторить</Button></AlertAction></Alert>
      ) : <DishesWorkspace data={query.data} />}
    </PageContainer>
  )
}
