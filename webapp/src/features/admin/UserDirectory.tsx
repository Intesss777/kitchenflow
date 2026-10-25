import { Search01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  type UserDto,
  type WorkspaceBranch,
  type WorkspaceMember,
  type WorkspaceRole,
  workspaceRoleSchema,
} from '@kitchenflow/contracts'
import { useState, type FormEvent } from 'react'

import { DataTableFrame } from '@/components/dashboard'
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import { Item } from '@/components/ui/item'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Typography } from '@/components/typography'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatDate } from '@/platform/intl'
import {
  adminUsersPagination,
  adminUsersViewState,
  roleMutationFeedback,
} from './model'
import {
  useUpdateWorkspaceMemberBranchAccessMutation,
  useUpdateWorkspaceMemberRoleMutation,
  useWorkspaceMembersQuery,
} from './queries'
import { BranchAccessDialog } from './BranchAccessDialog'
import { RoleChangeDialog } from './RoleChangeDialog'

type PendingRoleChange = {
  role: WorkspaceRole
  user: WorkspaceMember
}

type DirectoryRowsProps = {
  branches: ReadonlyArray<WorkspaceBranch>
  currentUser: UserDto
  isBranchAccessPending: boolean
  isRoleChangePending: boolean
  onBranchAccessChange: (user: WorkspaceMember) => void
  onRoleChange: (user: WorkspaceMember, role: WorkspaceRole) => void
  users: ReadonlyArray<WorkspaceMember>
}

// Tailwind's `sm` breakpoint. The frame's toolbar and footer stack below it through `sm:`
// classes, so the rows switch on the same edge. Below it the three columns do not fit a phone,
// and a table squeezed into a column with CSS loses its semantics: `display` overrides drop the
// table from the accessibility tree and a hidden `<thead>` takes the column labels with it. So
// each viewport gets markup of its own kind: a real table, or a list whose fields carry labels.
const tableViewportQuery = '(min-width: 40rem)'

export function UserDirectory({ currentUser }: { currentUser: UserDto }) {
  const [draftQuery, setDraftQuery] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingRole, setPendingRole] = useState<PendingRoleChange | null>(null)
  const [pendingBranchAccess, setPendingBranchAccess] = useState<WorkspaceMember | null>(null)
  const fitsTable = useMediaQuery(tableViewportQuery)
  const usersQuery = useWorkspaceMembersQuery({
    q: query || undefined,
    page,
    pageSize: 20,
  })
  const roleMutation = useUpdateWorkspaceMemberRoleMutation()
  const branchAccessMutation = useUpdateWorkspaceMemberBranchAccessMutation()
  const viewState = adminUsersViewState({
    isError: usersQuery.isError,
    isPending: usersQuery.isPending,
    itemCount: usersQuery.data?.items.length,
  })
  const mutationFeedback = roleMutationFeedback(roleMutation)
  const pagination = usersQuery.data
    ? adminUsersPagination(usersQuery.data)
    : null

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPage(1)
    setQuery(draftQuery.trim())
  }

  const requestRoleChange = (user: WorkspaceMember, role: WorkspaceRole) => {
    roleMutation.reset()
    setPendingRole({ role, user })
  }

  const confirmRoleChange = () => {
    if (!pendingRole) return
    roleMutation.mutate(
      { membershipId: pendingRole.user.id, role: pendingRole.role },
      { onSuccess: () => setPendingRole(null) },
    )
  }

  const confirmBranchAccess = (input: { allBranches: boolean; branchIds: string[] }) => {
    if (!pendingBranchAccess) return
    branchAccessMutation.mutate(
      { membershipId: pendingBranchAccess.id, ...input },
      { onSuccess: () => setPendingBranchAccess(null) },
    )
  }

  const summary = usersQuery.data
    ? `Страница ${usersQuery.data.page} из ${pagination?.totalPages ?? 1} · ${usersQuery.data.total} аккаунта${
        pagination?.wasBounded
          ? ` · Доступны первые ${pagination.reachableUsers}`
          : ''
      }`
    : viewState === 'error'
      ? 'Список недоступен'
      : 'Загружаем аккаунты'

  return (
    <>
      <div className="grid gap-4">
        {mutationFeedback?.kind === 'success' && (
          <Alert data-testid="role-change-success">
            <AlertTitle>Роль изменена</AlertTitle>
            <AlertDescription>
              Для {mutationFeedback.user.email} установлена роль «{roleLabel(mutationFeedback.user.role)}».
              Предыдущие сессии завершены.
            </AlertDescription>
          </Alert>
        )}
        {branchAccessMutation.isSuccess && (
          <Alert data-testid="branch-access-success">
            <AlertTitle>Доступ изменён</AlertTitle>
            <AlertDescription>
              Настройки филиалов сохранены для {branchAccessMutation.data.member.email}.
            </AlertDescription>
          </Alert>
        )}

        <DataTableFrame
          description="Изменение роли завершает активные сессии этого аккаунта."
          nextDisabled={!pagination?.canGoNext}
          onNext={() => setPage((current) => current + 1)}
          onPrevious={() => setPage((current) => Math.max(1, current - 1))}
          previousDisabled={page <= 1}
          summary={summary}
          title="Аккаунты компании"
          toolbar={
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={submitSearch}>
              <InputGroup>
                <InputGroupAddon>
                  <HugeiconsIcon aria-hidden icon={Search01Icon} strokeWidth={2} />
                </InputGroupAddon>
                <InputGroupInput
                    aria-label="Поиск аккаунтов"
                  data-testid="user-search-input"
                  onChange={(event) => setDraftQuery(event.target.value)}
                    placeholder="Имя или email"
                  value={draftQuery}
                />
              </InputGroup>
              <Button data-testid="user-search-submit" type="submit">Найти</Button>
            </form>
          }
        >
          {viewState === 'loading' && <DirectoryLoading />}
          {viewState === 'error' && usersQuery.isError && (
            <DirectoryError
              error={usersQuery.error}
              onRetry={() => void usersQuery.refetch()}
            />
          )}
          {viewState === 'empty' && <DirectoryEmpty hasQuery={query.length > 0} />}
          {viewState === 'ready' && usersQuery.data && (
            fitsTable ? (
              <UserTable
                branches={usersQuery.data.branches}
                currentUser={currentUser}
                isBranchAccessPending={branchAccessMutation.isPending}
                isRoleChangePending={roleMutation.isPending}
                onBranchAccessChange={(user) => {
                  branchAccessMutation.reset()
                  setPendingBranchAccess(user)
                }}
                onRoleChange={requestRoleChange}
                users={usersQuery.data.items}
              />
            ) : (
              <UserList
                branches={usersQuery.data.branches}
                currentUser={currentUser}
                isBranchAccessPending={branchAccessMutation.isPending}
                isRoleChangePending={roleMutation.isPending}
                onBranchAccessChange={(user) => {
                  branchAccessMutation.reset()
                  setPendingBranchAccess(user)
                }}
                onRoleChange={requestRoleChange}
                users={usersQuery.data.items}
              />
            )
          )}
        </DataTableFrame>
      </div>

      <RoleChangeDialog
        failureReason={mutationFeedback?.kind === 'error' ? mutationFeedback.reason : null}
        isPending={roleMutation.isPending}
        onCancel={() => {
          roleMutation.reset()
          setPendingRole(null)
        }}
        onConfirm={confirmRoleChange}
        pendingChange={pendingRole}
      />
      <BranchAccessDialog
        branches={usersQuery.data?.branches ?? []}
        error={branchAccessMutation.error}
        isPending={branchAccessMutation.isPending}
        member={pendingBranchAccess}
        onClose={() => {
          branchAccessMutation.reset()
          setPendingBranchAccess(null)
        }}
        onSave={confirmBranchAccess}
      />
    </>
  )
}

function UserTable({
  branches,
  currentUser,
  isBranchAccessPending,
  isRoleChangePending,
  onBranchAccessChange,
  onRoleChange,
  users,
}: DirectoryRowsProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Аккаунт</TableHead>
          <TableHead>Роль</TableHead>
          <TableHead>Филиалы</TableHead>
          <TableHead>Доступ с</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow data-testid="user-row" key={user.id}>
            <TableCell>
              <div className="grid">
                <Typography variant="bodySmMedium">
                  {user.displayName ?? user.email}
                </Typography>
                <Typography variant="caption" tone="muted">
                  {user.email}
                </Typography>
              </div>
            </TableCell>
            <TableCell>
              <RoleSelect
                currentUser={currentUser}
                disabled={isRoleChangePending}
                onRoleChange={onRoleChange}
                user={user}
              />
            </TableCell>
            <TableCell>
              <BranchAccessControl
                branches={branches}
                disabled={isBranchAccessPending}
                onChange={onBranchAccessChange}
                user={user}
              />
            </TableCell>
            <TableCell>
              <Typography as="span" className="tabular-nums" variant="bodySm">
                {formatDate(user.createdAt)}
              </Typography>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

/**
 * The narrow counterpart of `UserTable`: one list item per user, each a definition list whose
 * terms name the fields the table names with column headers. "User" and "Role" are visible in
 * the values themselves and stay screen-reader only; "Created" is the one a bare date needs.
 */
function UserList({
  branches,
  currentUser,
  isBranchAccessPending,
  isRoleChangePending,
  onBranchAccessChange,
  onRoleChange,
  users,
}: DirectoryRowsProps) {
  return (
    // Explicit `role="list"`: WebKit drops list semantics from an unstyled `<ul>`, and phones
    // are exactly where this markup renders.
    <ul aria-label="Аккаунты" className="grid gap-3" role="list">
      {users.map((user) => (
        <Item asChild key={user.id} variant="outline">
          <li data-testid="user-row">
            <dl className="grid w-full gap-3">
              <div className="grid min-w-0">
                <Typography as="dt" variant="srOnly">
                  Аккаунт
                </Typography>
                <dd className="grid">
                  <Typography variant="bodySmMedium">
                    {user.displayName ?? user.email}
                  </Typography>
                  <Typography variant="caption" tone="muted" wrap="break">
                    {user.email}
                  </Typography>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <Typography as="dt" variant="caption" tone="muted">
                  Роль
                </Typography>
                <dd>
                  <RoleSelect
                    currentUser={currentUser}
                    disabled={isRoleChangePending}
                    onRoleChange={onRoleChange}
                    user={user}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <Typography as="dt" variant="caption" tone="muted">
                  Филиалы
                </Typography>
                <dd>
                  <BranchAccessControl
                    branches={branches}
                    disabled={isBranchAccessPending}
                    onChange={onBranchAccessChange}
                    user={user}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <Typography as="dt" variant="caption" tone="muted">
                  Доступ с
                </Typography>
                <Typography as="dd" variant="bodySm">
                  {formatDate(user.createdAt)}
                </Typography>
              </div>
            </dl>
          </li>
        </Item>
      ))}
    </ul>
  )
}

function BranchAccessControl({
  branches,
  disabled,
  onChange,
  user,
}: {
  branches: ReadonlyArray<WorkspaceBranch>
  disabled: boolean
  onChange: (user: WorkspaceMember) => void
  user: WorkspaceMember
}) {
  const label = user.branchAccess.allBranches
    ? 'Все филиалы'
    : branches
      .filter((branch) => user.branchAccess.branchIds.includes(branch.id))
      .map((branch) => branch.name)
      .join(', ')

  if (user.role === 'owner') {
    return <Typography as="span" variant="bodySm">Все филиалы</Typography>
  }

  return (
    <Button
      data-testid="branch-access-edit"
      disabled={disabled}
      onClick={() => onChange(user)}
      size="sm"
      type="button"
      variant="outline"
    >
      {label}
    </Button>
  )
}

function RoleSelect({
  currentUser,
  disabled,
  onRoleChange,
  user,
}: {
  currentUser: UserDto
  disabled: boolean
  onRoleChange: (user: WorkspaceMember, role: WorkspaceRole) => void
  user: WorkspaceMember
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(value) => {
        const parsedRole = workspaceRoleSchema.safeParse(value)
        if (parsedRole.success && parsedRole.data !== user.role) {
          onRoleChange(user, parsedRole.data)
        }
      }}
      value={user.role}
    >
      <SelectTrigger
        aria-label={`Role for ${user.email}`}
        className="w-40"
        data-testid="role-select"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          data-testid="role-option-owner"
          disabled={user.userId === currentUser.id && user.role === 'owner'}
          value="owner"
        >
          Владелец
        </SelectItem>
        <SelectItem data-testid="role-option-chef" value="chef">Шеф-повар</SelectItem>
        <SelectItem data-testid="role-option-administrator" value="administrator">
          Администратор
        </SelectItem>
      </SelectContent>
    </Select>
  )
}

function DirectoryLoading() {
  return (
    <div aria-label="Загружаем аккаунты" className="grid gap-3 py-2" role="status">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

function DirectoryError({
  error,
  onRetry,
}: {
  error: Error
  onRetry: () => void
}) {
  return (
    <Alert variant="destructive">
      <AlertTitle>Не удалось загрузить аккаунты</AlertTitle>
      <AlertDescription>{error.message}</AlertDescription>
      <AlertAction>
        <Button onClick={onRetry} size="sm" type="button" variant="outline">
          Повторить
        </Button>
      </AlertAction>
    </Alert>
  )
}

function DirectoryEmpty({ hasQuery }: { hasQuery: boolean }) {
  return (
    <Empty data-testid="user-directory-empty">
      <EmptyHeader>
        <EmptyTitle>Аккаунты не найдены</EmptyTitle>
        <EmptyDescription>
          {hasQuery
            ? 'Попробуйте другое имя или email.'
            : 'У компании пока нет аккаунтов с доступом.'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function roleLabel(role: WorkspaceRole) {
  if (role === 'owner') return 'Владелец'
  if (role === 'administrator') return 'Администратор'
  return 'Шеф-повар'
}
