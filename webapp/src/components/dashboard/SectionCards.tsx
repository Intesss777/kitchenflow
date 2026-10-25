import type { IconSvgElement } from '@hugeicons/react'
import { HugeiconsIcon } from '@hugeicons/react'

import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { Typography } from '@/components/typography'
import { cn } from '@/lib/utils'

export type SectionMetric = {
  description?: string
  icon?: IconSvgElement
  label: string
  value: number | string
}

export function SectionCards({
  className,
  items,
}: {
  className?: string
  items: ReadonlyArray<SectionMetric>
}) {
  return (
    <div className={cn(
      'grid grid-cols-2 gap-3 xl:grid-cols-3',
      className,
    )}>
      {items.map((item) => (
        <Card className="py-0 shadow-none" key={item.label} title={item.description}>
          <CardContent className="flex min-h-20 items-center gap-3 p-4">
            {item.icon && (
              <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HugeiconsIcon icon={item.icon} strokeWidth={2} />
              </span>
            )}
            <div className="min-w-0">
              <Typography as="div" tone="muted" truncate variant="caption">{item.label}</Typography>
              <Typography as="div" className="mt-1 tabular-nums" variant="h5">{item.value}</Typography>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
