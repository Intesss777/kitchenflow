import { CameraAdd02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ShiftsWorkspace } from './ShiftsWorkspace'
import { useSalesShiftsQuery } from './queries'

export function ShiftsPage() {
  const query = useSalesShiftsQuery()
  return (
    <PageContainer>
      <PageHeader title="Закрытие смены" />
      {query.isPending ? (
        <div aria-label="Загрузка смен" className="grid gap-6" role="status"><div className="grid gap-4 md:grid-cols-4"><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /></div><Skeleton className="h-[620px] rounded-4xl" /></div>
      ) : query.isError ? (
        <Alert variant="destructive"><AlertTitle>Не удалось загрузить смены</AlertTitle><AlertDescription>{query.error.message}</AlertDescription><AlertAction><Button onClick={() => void query.refetch()} size="sm" variant="outline"><HugeiconsIcon icon={CameraAdd02Icon} />Повторить</Button></AlertAction></Alert>
      ) : <ShiftsWorkspace data={query.data} />}
    </PageContainer>
  )
}
