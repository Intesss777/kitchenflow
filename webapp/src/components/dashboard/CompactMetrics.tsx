import { Typography } from '@/components/typography'

export type CompactMetric = {
  description?: string
  label: string
  value: number | string
}

export function CompactMetrics({
  items,
}: {
  items: ReadonlyArray<CompactMetric>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <div
          className="flex min-h-9 min-w-0 items-center gap-2 rounded-full border bg-card px-3 py-2 shadow-xs"
          key={item.label}
          title={item.description}
        >
          <Typography as="span" tone="muted" truncate variant="caption">
            {item.label}
          </Typography>
          <Typography
            as="span"
            className="tabular-nums"
            truncate
            variant="bodySmMedium"
          >
            {item.value}
          </Typography>
        </div>
      ))}
    </div>
  )
}
