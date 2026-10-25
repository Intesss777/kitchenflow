import type { WorkspaceMember, WorkspaceRole } from '@kitchenflow/contracts'

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
import { Button } from '@/components/ui/button'

export function RoleChangeDialog({
  failureReason,
  isPending,
  onCancel,
  onConfirm,
  pendingChange,
}: {
  failureReason: string | null
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
  pendingChange: {
    role: WorkspaceRole
    user: WorkspaceMember
  } | null
}) {
  return (
    <AlertDialog
      open={pendingChange !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Изменить роль?</AlertDialogTitle>
          <AlertDialogDescription>
            {pendingChange
              ? `${pendingChange.user.email}: новая роль — ${roleLabel(pendingChange.role)}. Активные сессии будут завершены.`
              : ''}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failureReason !== null && (
          <Alert variant="destructive">
            <AlertTitle>Роль не изменена</AlertTitle>
            <AlertDescription>{failureReason}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Отмена</AlertDialogCancel>
          <Button data-testid="role-change-confirm" disabled={isPending} onClick={onConfirm}>
            {isPending ? 'Изменяем…' : 'Изменить роль'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function roleLabel(role: WorkspaceRole) {
  if (role === 'owner') return 'владелец'
  if (role === 'administrator') return 'администратор'
  return 'шеф-повар'
}
