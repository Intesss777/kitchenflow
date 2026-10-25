import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'

import { Typography } from '@/components/typography'
import { kitchenModules } from './kitchen-modules'

export function KitchenModules() {
  return (
    <section aria-labelledby="kitchen-modules-title" className="grid gap-3">
      <Typography as="h2" id="kitchen-modules-title" variant="h4">Разделы</Typography>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kitchenModules.map((module) => (
          <Link className="flex min-h-24 flex-col items-start justify-between rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" key={module.title} to={module.href}>
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><HugeiconsIcon aria-hidden icon={module.icon} size={20} strokeWidth={2} /></span>
            <Typography as="span" variant="bodySmMedium">{module.title}</Typography>
          </Link>
        ))}
      </div>
    </section>
  )
}
