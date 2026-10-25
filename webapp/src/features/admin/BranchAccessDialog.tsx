import type { WorkspaceBranch, WorkspaceMember } from '@kitchenflow/contracts'
import { useState, type FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Typography } from '@/components/typography'

export function BranchAccessDialog({
  branches,
  error,
  isPending,
  member,
  onClose,
  onSave,
}: {
  branches: ReadonlyArray<WorkspaceBranch>
  error: Error | null
  isPending: boolean
  member: WorkspaceMember | null
  onClose: () => void
  onSave: (input: { allBranches: boolean; branchIds: string[] }) => void
}) {
  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose()
      }}
    >
      {member && (
        <BranchAccessForm
          branches={branches}
          error={error}
          isPending={isPending}
          key={`${member.id}:${member.branchAccess.allBranches}:${member.branchAccess.branchIds.join(',')}`}
          member={member}
          onClose={onClose}
          onSave={onSave}
        />
      )}
    </Dialog>
  )
}

function BranchAccessForm({
  branches,
  error,
  isPending,
  member,
  onClose,
  onSave,
}: {
  branches: ReadonlyArray<WorkspaceBranch>
  error: Error | null
  isPending: boolean
  member: WorkspaceMember
  onClose: () => void
  onSave: (input: { allBranches: boolean; branchIds: string[] }) => void
}) {
  const [allBranches, setAllBranches] = useState(member.branchAccess.allBranches)
  const [branchIds, setBranchIds] = useState<string[]>(member.branchAccess.branchIds)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!allBranches && branchIds.length === 0) return
    onSave({ allBranches, branchIds: allBranches ? [] : branchIds })
  }

  return (
    <DialogContent>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>Доступ к филиалам</DialogTitle>
          <DialogDescription>Выберите филиалы для {member.email}.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-5">
          <label className="flex items-center gap-3">
            <Checkbox
              checked={allBranches}
              data-testid="branch-access-all"
              onCheckedChange={(checked) => setAllBranches(checked === true)}
            />
            <Typography as="span" variant="bodySmMedium">Все филиалы</Typography>
          </label>
          {!allBranches && (
            <div className="grid gap-3 border-l pl-4">
              {branches.map((branch) => (
                <label className="flex items-center gap-3" key={branch.id}>
                  <Checkbox
                    checked={branchIds.includes(branch.id)}
                    data-testid="branch-access-option"
                    onCheckedChange={(checked) => {
                      setBranchIds((current) => checked === true
                        ? Array.from(new Set([...current, branch.id]))
                        : current.filter((id) => id !== branch.id))
                    }}
                  />
                  <Typography as="span" variant="bodySm">{branch.name}</Typography>
                </label>
              ))}
            </div>
          )}
          {!allBranches && branchIds.length === 0 && (
            <Typography role="alert" variant="caption" tone="destructive">
              Выберите хотя бы один филиал.
            </Typography>
          )}
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Доступ не изменён</AlertTitle>
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
            Отмена
          </Button>
          <Button
            data-testid="branch-access-save"
            disabled={isPending || (!allBranches && branchIds.length === 0)}
            type="submit"
          >
            {isPending ? 'Сохраняем…' : 'Сохранить доступ'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
