import type { PropsWithChildren, ReactNode } from 'react'

import { Typography } from '@/components/typography'

export function PageContainer({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-5 p-4 sm:p-5 md:p-6 xl:p-8">
      {children}
    </div>
  )
}

export function PageHeader({
  actions,
  description,
  title,
}: {
  actions?: ReactNode
  description?: ReactNode
  title: string
}) {
  return (
    <>
      <Typography variant="srOnly">{title}</Typography>
      {(description || actions) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {description && <Typography tone="muted">{description}</Typography>}
          {actions && <PageHeaderActions>{actions}</PageHeaderActions>}
        </div>
      )}
    </>
  )
}

function PageHeaderActions({ children }: PropsWithChildren) {
  return <div>{children}</div>
}
