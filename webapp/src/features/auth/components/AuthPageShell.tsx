import { KitchenUtensilsIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Typography } from '@/components/typography'
import { Card, CardContent } from '@/components/ui/card'

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col bg-muted/40 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex justify-center">
        <Link className="flex items-center gap-2" search={{ returnTo: undefined }} to="/login">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HugeiconsIcon aria-hidden icon={KitchenUtensilsIcon} size={20} strokeWidth={2} />
          </span>
          <Typography as="span" variant="h6">
            KitchenFlow
          </Typography>
        </Link>
      </div>

      <section className="flex flex-1 items-center justify-center py-8 sm:py-10">
        <Card className="w-full max-w-md py-8 sm:py-10">
          <CardContent className="px-6 sm:px-10">{children}</CardContent>
        </Card>
      </section>

      <Typography align="center" tone="muted" variant="caption">
        KitchenFlow · управление рестораном без лишнего шума
      </Typography>
    </main>
  )
}
