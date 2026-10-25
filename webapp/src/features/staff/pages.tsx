import { UserGroupIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useState } from 'react'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StaffWorkspace } from './StaffWorkspace'
import { useStaffOverviewQuery } from './queries'

export function StaffPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null)
  const query = useStaffOverviewQuery(month)
  return (
    <PageContainer>
      <PageHeader title="Сотрудники" />
      {query.isPending ? (
        <div aria-label="Загрузка сотрудников" className="grid gap-6" role="status"><div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /><Skeleton className="h-36 rounded-4xl" /></div><Skeleton className="h-[520px] rounded-4xl" /></div>
      ) : query.isError ? (
        <Alert variant="destructive"><AlertTitle>Не удалось загрузить сотрудников</AlertTitle><AlertDescription>{query.error.message}</AlertDescription><AlertAction><Button onClick={() => void query.refetch()} size="sm" variant="outline"><HugeiconsIcon icon={UserGroupIcon} />Повторить</Button></AlertAction></Alert>
      ) : (
        <StaffWorkspace
          month={month}
          onMonthChange={setMonth}
          onSelectedEmployeeIdChange={setSelectedEmployeeId}
          overview={query.data}
          selectedEmployeeId={selectedEmployeeId}
        />
      )}
    </PageContainer>
  )
}
