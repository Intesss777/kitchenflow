import type { ActiveWorkspace } from '@kitchenflow/contracts'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Typography } from '@/components/typography'
import { cn } from '@/lib/utils'
import { useSwitchWorkspaceBranchMutation } from './queries'

export function WorkspaceBranchSelect({
  compact = false,
  workspace,
}: {
  compact?: boolean
  workspace: ActiveWorkspace
}) {
  const branchMutation = useSwitchWorkspaceBranchMutation()

  return (
    <div
      className={cn(
        'group-data-[collapsible=icon]:hidden',
        compact ? 'flex items-center' : 'grid gap-1',
      )}
    >
      {!compact && (
        <Typography as="span" variant="caption" tone="muted">
          Филиал
        </Typography>
      )}
      <Select
        disabled={branchMutation.isPending || workspace.availableBranches.length === 1}
        onValueChange={(branchId) => {
          if (branchId !== workspace.branchId) branchMutation.mutate(branchId)
        }}
        value={workspace.branchId}
      >
        <SelectTrigger
          aria-label="Текущий филиал"
          className={compact ? 'w-42 bg-background' : 'w-full'}
          data-testid="workspace-branch-select"
          size={compact ? 'sm' : 'default'}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {workspace.availableBranches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {branchMutation.isError && (
        <Typography
          className={compact ? 'sr-only' : undefined}
          role="alert"
          variant="caption"
          tone="destructive"
        >
          Не удалось сменить филиал
        </Typography>
      )}
    </div>
  )
}
