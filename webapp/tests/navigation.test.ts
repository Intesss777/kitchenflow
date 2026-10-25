import { expect, test } from 'bun:test'
import type { WorkspaceRole } from '@kitchenflow/contracts'

import { kitchenModules } from '../src/components/dashboard/kitchen-modules'
import {
  homePathForRole,
  navigationItemsForRole,
  resolveRoleDestination,
  safeReturnPath,
  workspaceRoutesByRole,
} from '../src/features/navigation/model'
import { router } from '../src/routes'

test('workspace navigation follows the membership role', () => {
  expect(navigationItemsForRole('chef').every((item) => item.to.startsWith('/app'))).toBe(true)
  expect(navigationItemsForRole('owner').every((item) => item.to.startsWith('/admin'))).toBe(true)
  expect(navigationItemsForRole('administrator').map((item) => item.to)).toEqual([
    '/admin/inventory', '/admin/invoices', '/admin/suppliers', '/admin/settings',
  ])
  expect(navigationItemsForRole('chef').some((item) => item.to.endsWith('/invoices'))).toBe(false)
  expect(homePathForRole('chef')).toBe('/app')
  expect(homePathForRole('owner')).toBe('/admin')
  expect(homePathForRole('administrator')).toBe('/admin/inventory')
})

test('chef home quick-access cards point only to permitted chef routes', () => {
  expect(kitchenModules.map((item) => ({ title: item.title, href: item.href }))).toEqual([
    { title: 'Склад', href: '/app/inventory' },
    { title: 'Закупка', href: '/app/purchases' },
    { title: 'Карты блюд', href: '/app/dishes' },
    { title: 'Команда', href: '/app/staff' },
  ])
  expect(kitchenModules.every((item) => workspaceRoutesByRole.chef.includes(item.href))).toBe(true)
})

test('cross-role and forbidden destinations resolve to the role home', () => {
  expect(resolveRoleDestination('chef', '/app/profile')).toBe('/app/profile')
  expect(resolveRoleDestination('chef', '/app/invoices')).toBe('/app')
  expect(resolveRoleDestination('chef', '/admin/users')).toBe('/app')
  expect(resolveRoleDestination('owner', '/admin/settings')).toBe('/admin/settings')
  expect(resolveRoleDestination('administrator', '/admin/users')).toBe('/admin/inventory')
  expect(resolveRoleDestination('administrator', '/admin/invoices')).toBe('/admin/invoices')
})

test('every role route is registered under a protected workspace layout', () => {
  const registered = new Set(
    Object.values(router.routesById)
      .filter((route) => typeof route.path === 'string')
      .filter((route) => {
        let layout = route.parentRoute
        while (layout && !['/adminWorkspace', '/userWorkspace'].includes(layout.id)) {
          layout = layout.parentRoute
        }
        return Boolean(layout)
      })
      .map((route) => route.fullPath),
  )

  for (const role of ['owner', 'chef', 'administrator'] as const) {
    for (const path of workspaceRoutesByRole[role]) expect(registered.has(path)).toBe(true)
  }
})

test('workspace route table uses only supported route shapes', () => {
  const supportedSegment = /^(\$[A-Za-z_]\w*|[^${}]+)$/
  for (const paths of Object.values(workspaceRoutesByRole)) {
    for (const pattern of paths) {
      for (const segment of pattern.split('/').slice(1)) expect(segment).toMatch(supportedSegment)
    }
  }
})

test('every permitted route round-trips as a return path', () => {
  for (const role of ['owner', 'chef', 'administrator'] as const) {
    for (const path of workspaceRoutesByRole[role]) expect(safeReturnPath(role, path)).toBe(path)
  }
  expect(safeReturnPath('owner', '/admin/users?page=2')).toBe('/admin/users?page=2')
})

test('parameterised routes belong only to the configured role', () => {
  const routes: Record<WorkspaceRole, ReadonlyArray<string>> = {
    owner: ['/admin', '/admin/users/$userId'],
    chef: ['/app', '/app/projects/$projectId'],
    administrator: ['/admin/invoices/$invoiceId'],
  }
  expect(safeReturnPath('chef', '/app/projects/42?tab=files', routes)).toBe('/app/projects/42?tab=files')
  expect(safeReturnPath('owner', '/admin/users/7', routes)).toBe('/admin/users/7')
  expect(safeReturnPath('administrator', '/admin/invoices/8', routes)).toBe('/admin/invoices/8')
  expect(safeReturnPath('owner', '/app/projects/42', routes)).toBeNull()
  expect(safeReturnPath('chef', '/app/projects', routes)).toBeNull()
  expect(safeReturnPath('chef', '/app/projects/42/extra', routes)).toBeNull()
})

test('return paths reject public pages and open redirects', () => {
  expect(safeReturnPath('chef', '/admin')).toBeNull()
  expect(safeReturnPath('administrator', '/admin/users')).toBeNull()
  expect(safeReturnPath('owner', '/app/profile')).toBeNull()
  expect(safeReturnPath('chef', '/')).toBeNull()
  expect(safeReturnPath('chef', '/login')).toBeNull()
  expect(safeReturnPath('owner', undefined)).toBeNull()
  expect(safeReturnPath('owner', 'https://attacker.example/admin')).toBeNull()
  expect(safeReturnPath('owner', 'javascript:alert(1)')).toBeNull()
  expect(safeReturnPath('owner', '//attacker.example/admin')).toBeNull()
  expect(safeReturnPath('owner', '/\\attacker.example/admin')).toBeNull()
})
