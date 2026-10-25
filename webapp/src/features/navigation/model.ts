import type { WorkspaceRole } from '@kitchenflow/contracts'

export const workspaceRoutesByRole = {
  owner: [
    '/admin', '/admin/inventory', '/admin/purchases', '/admin/invoices', '/admin/dishes',
    '/admin/shifts', '/admin/staff', '/admin/suppliers', '/admin/users', '/admin/settings',
  ],
  chef: [
    '/app', '/app/inventory', '/app/purchases', '/app/dishes', '/app/shifts', '/app/staff',
    '/app/profile', '/app/settings',
  ],
  administrator: [
    '/admin/inventory', '/admin/invoices', '/admin/suppliers', '/admin/settings',
  ],
} as const satisfies Record<WorkspaceRole, ReadonlyArray<`/${string}`>>

type WorkspaceRouteTable = Record<WorkspaceRole, ReadonlyArray<string>>
type StaticPath<T extends string> = T extends `${string}$${string}` ? never : T
export type WorkspaceRoutePath = StaticPath<
  (typeof workspaceRoutesByRole)[WorkspaceRole][number]
>
export type UserRoutePath = WorkspaceRoutePath
export type AdminRoutePath = WorkspaceRoutePath

const navigationByRole = {
  owner: [
    { label: 'Обзор', to: '/admin' },
    { label: 'Склад', to: '/admin/inventory' },
    { label: 'Закупка', to: '/admin/purchases' },
    { label: 'Накладные', to: '/admin/invoices' },
    { label: 'Карты блюд', to: '/admin/dishes' },
    { label: 'Закрытие смены', to: '/admin/shifts' },
    { label: 'Сотрудники', to: '/admin/staff' },
    { label: 'Поставщики', to: '/admin/suppliers' },
    { label: 'Доступы', to: '/admin/users' },
    { label: 'Настройки', to: '/admin/settings' },
  ],
  chef: [
    { label: 'Сегодня', to: '/app' },
    { label: 'Склад', to: '/app/inventory' },
    { label: 'Закупка', to: '/app/purchases' },
    { label: 'Карты блюд', to: '/app/dishes' },
    { label: 'Закрытие смены', to: '/app/shifts' },
    { label: 'Сотрудники', to: '/app/staff' },
    { label: 'Профиль', to: '/app/profile' },
    { label: 'Настройки', to: '/app/settings' },
  ],
  administrator: [
    { label: 'Склад', to: '/admin/inventory' },
    { label: 'Накладные', to: '/admin/invoices' },
    { label: 'Поставщики', to: '/admin/suppliers' },
    { label: 'Настройки', to: '/admin/settings' },
  ],
} as const satisfies Record<
  WorkspaceRole,
  ReadonlyArray<{ label: string; to: WorkspaceRoutePath }>
>

export function navigationItemsForRole(role: WorkspaceRole) {
  return navigationByRole[role]
}

export function homePathForRole(role: WorkspaceRole): '/app' | '/admin' | '/admin/inventory' {
  if (role === 'chef') return '/app'
  if (role === 'administrator') return '/admin/inventory'
  return '/admin'
}

export function resolveRoleDestination(role: WorkspaceRole, pathname: string): string {
  return isWorkspacePath(role, pathname) ? pathname : homePathForRole(role)
}

export function safeReturnPath(
  role: WorkspaceRole,
  value: string | undefined,
  routes: WorkspaceRouteTable = workspaceRoutesByRole,
): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null

  let url: URL
  try {
    url = new URL(value, 'https://app.invalid')
  } catch {
    return null
  }
  if (url.origin !== 'https://app.invalid') return null
  return isWorkspacePath(role, url.pathname, routes) ? `${url.pathname}${url.search}` : null
}

function isWorkspacePath(
  role: WorkspaceRole,
  pathname: string,
  routes: WorkspaceRouteTable = workspaceRoutesByRole,
): boolean {
  return routes[role].some((pattern) => matchesRoutePattern(pattern, pathname))
}

function matchesRoutePattern(pattern: string, pathname: string): boolean {
  const patternSegments = pattern.split('/')
  const pathSegments = pathname.split('/')
  if (patternSegments.length !== pathSegments.length) return false
  return patternSegments.every((segment, index) => {
    const actual = pathSegments[index] ?? ''
    const isNamedParam = segment.length > 1 && segment.startsWith('$')
    return isNamedParam ? actual !== '' : segment === actual
  })
}
