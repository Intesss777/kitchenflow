import type { ManagedWorkspaceBranch } from '@kitchenflow/contracts'
import { useState, type FormEvent } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Typography } from '@/components/typography'
import {
  useCreateWorkspaceBranchMutation,
  useUpdateWorkspaceBranchMutation,
  useUpdateWorkspaceBranchStatusMutation,
  useWorkspaceBranchesQuery,
} from './queries'

type BranchFormState =
  | { kind: 'create' }
  | { kind: 'edit'; branch: ManagedWorkspaceBranch }
  | null

export function BranchManagementPanel() {
  const branchesQuery = useWorkspaceBranchesQuery()
  const createMutation = useCreateWorkspaceBranchMutation()
  const updateMutation = useUpdateWorkspaceBranchMutation()
  const statusMutation = useUpdateWorkspaceBranchStatusMutation()
  const [formState, setFormState] = useState<BranchFormState>(null)
  const [statusBranch, setStatusBranch] = useState<ManagedWorkspaceBranch | null>(null)

  const closeForm = () => {
    if (createMutation.isPending || updateMutation.isPending) return
    createMutation.reset()
    updateMutation.reset()
    setFormState(null)
  }

  const saveBranch = (input: { name: string; address: string | null }) => {
    if (!formState) return
    if (formState.kind === 'create') {
      createMutation.mutate(input, { onSuccess: () => setFormState(null) })
      return
    }
    updateMutation.mutate(
      { branchId: formState.branch.id, input },
      { onSuccess: () => setFormState(null) },
    )
  }

  const confirmStatus = () => {
    if (!statusBranch) return
    statusMutation.mutate(
      { branchId: statusBranch.id, isActive: !statusBranch.isActive },
      { onSuccess: () => setStatusBranch(null) },
    )
  }

  return (
    <>
      <Card>
        <CardHeader>
          <Typography as="h2" variant="h6">Филиалы</Typography>
          <CardDescription>
            Добавляйте точки и архивируйте закрытые, не удаляя их историю.
          </CardDescription>
          <CardAction>
            <Button
              data-testid="branch-create"
              onClick={() => {
                createMutation.reset()
                updateMutation.reset()
                setFormState({ kind: 'create' })
              }}
              size="sm"
              type="button"
            >
              Добавить
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {statusMutation.isSuccess && (
            <Alert className="mb-4" data-testid="branch-status-success">
              <AlertTitle>Статус филиала изменён</AlertTitle>
              <AlertDescription>
                {statusMutation.data.branch.isActive
                  ? 'Филиал снова доступен сотрудникам.'
                  : 'Филиал перенесён в архив, история сохранена.'}
              </AlertDescription>
            </Alert>
          )}
          {branchesQuery.isPending && <BranchListLoading />}
          {branchesQuery.isError && (
            <Alert variant="destructive">
              <AlertTitle>Не удалось загрузить филиалы</AlertTitle>
              <AlertDescription>{branchesQuery.error.message}</AlertDescription>
              <Button
                className="mt-3"
                onClick={() => void branchesQuery.refetch()}
                size="sm"
                type="button"
                variant="outline"
              >
                Повторить
              </Button>
            </Alert>
          )}
          {branchesQuery.data?.items.length === 0 && (
            <Typography tone="muted" variant="bodySm">
              Филиалы ещё не добавлены.
            </Typography>
          )}
          {branchesQuery.data && branchesQuery.data.items.length > 0 && (
            <div className="divide-y">
              {branchesQuery.data.items.map((branch) => (
                <div
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  data-testid="managed-branch-row"
                  key={branch.id}
                >
                  <div className="grid min-w-0 gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Typography as="h3" variant="bodySmMedium">{branch.name}</Typography>
                      <Badge variant={branch.isActive ? 'secondary' : 'outline'}>
                        {branch.isActive ? 'Активен' : 'В архиве'}
                      </Badge>
                    </div>
                    <Typography variant="caption" tone="muted">
                      {branch.address ?? 'Адрес не указан'}
                    </Typography>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        createMutation.reset()
                        updateMutation.reset()
                        setFormState({ kind: 'edit', branch })
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Изменить
                    </Button>
                    <Button
                      data-testid="branch-status-change"
                      onClick={() => {
                        statusMutation.reset()
                        setStatusBranch(branch)
                      }}
                      size="sm"
                      type="button"
                      variant={branch.isActive ? 'outline' : 'secondary'}
                    >
                      {branch.isActive ? 'В архив' : 'Восстановить'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BranchFormDialog
        error={createMutation.error ?? updateMutation.error}
        isPending={createMutation.isPending || updateMutation.isPending}
        onClose={closeForm}
        onSave={saveBranch}
        state={formState}
      />
      <BranchStatusDialog
        branch={statusBranch}
        error={statusMutation.error}
        isPending={statusMutation.isPending}
        onClose={() => {
          if (statusMutation.isPending) return
          statusMutation.reset()
          setStatusBranch(null)
        }}
        onConfirm={confirmStatus}
      />
    </>
  )
}

function BranchFormDialog({
  error,
  isPending,
  onClose,
  onSave,
  state,
}: {
  error: Error | null
  isPending: boolean
  onClose: () => void
  onSave: (input: { name: string; address: string | null }) => void
  state: BranchFormState
}) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      {state && (
        <BranchForm
          error={error}
          isPending={isPending}
          key={state.kind === 'create' ? 'create' : state.branch.id}
          onClose={onClose}
          onSave={onSave}
          state={state}
        />
      )}
    </Dialog>
  )
}

function BranchForm({
  error,
  isPending,
  onClose,
  onSave,
  state,
}: {
  error: Error | null
  isPending: boolean
  onClose: () => void
  onSave: (input: { name: string; address: string | null }) => void
  state: Exclude<BranchFormState, null>
}) {
  const [name, setName] = useState(state.kind === 'edit' ? state.branch.name : '')
  const [address, setAddress] = useState(state.kind === 'edit' ? state.branch.address ?? '' : '')
  const [validationError, setValidationError] = useState<string | null>(null)

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalizedName = name.trim()
    if (!normalizedName) {
      setValidationError('Введите название филиала.')
      return
    }
    setValidationError(null)
    onSave({ name: normalizedName, address: address.trim() || null })
  }

  return (
    <DialogContent>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>
            {state.kind === 'create' ? 'Новый филиал' : 'Изменить филиал'}
          </DialogTitle>
          <DialogDescription>
            Название будет видно в переключателе филиалов у сотрудников.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup className="py-5">
          <Field>
            <FieldLabel htmlFor="branch-name">Название</FieldLabel>
            <Input
              autoFocus
              data-testid="branch-name"
              id="branch-name"
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="branch-address">Адрес</FieldLabel>
            <Input
              id="branch-address"
              maxLength={200}
              onChange={(event) => setAddress(event.target.value)}
              value={address}
            />
          </Field>
          {validationError && <FieldError>{validationError}</FieldError>}
          {error && <FieldError>{error.message}</FieldError>}
        </FieldGroup>
        <DialogFooter>
          <Button disabled={isPending} onClick={onClose} type="button" variant="outline">
            Отмена
          </Button>
          <Button data-testid="branch-save" disabled={isPending} type="submit">
            {isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}

function BranchStatusDialog({
  branch,
  error,
  isPending,
  onClose,
  onConfirm,
}: {
  branch: ManagedWorkspaceBranch | null
  error: Error | null
  isPending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const isArchiving = branch?.isActive === true
  return (
    <AlertDialog open={branch !== null} onOpenChange={(open) => {
      if (!open) onClose()
    }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isArchiving ? 'Архивировать филиал?' : 'Восстановить филиал?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isArchiving
              ? 'Филиал исчезнет из переключателя, но его документы и операции сохранятся.'
              : 'Филиал снова появится в списке доступных точек.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Статус не изменён</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <Button
            data-testid="branch-status-confirm"
            disabled={isPending}
            onClick={onConfirm}
            variant={isArchiving ? 'destructive' : 'default'}
          >
            {isPending ? 'Сохраняем…' : isArchiving ? 'Архивировать' : 'Восстановить'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function BranchListLoading() {
  return (
    <div aria-label="Загружаем филиалы" className="grid gap-3" role="status">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  )
}
