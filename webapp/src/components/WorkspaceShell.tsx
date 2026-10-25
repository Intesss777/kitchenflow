import {
  ChefHatIcon,
  Calendar03Icon,
  DashboardSquare01Icon,
  Dish02Icon,
  Invoice01Icon,
  Settings01Icon,
  ShoppingBasket01Icon,
  Store01Icon,
  WarehouseIcon,
  UserGroupIcon,
  UserIcon,
} from '@hugeicons/core-free-icons'
import { useLocation } from '@tanstack/react-router'
import type { UserDto } from '@kitchenflow/contracts'
import type { PropsWithChildren } from 'react'

import {
  AppSidebar,
  type DashboardNavigationItem,
  SiteHeader,
} from '@/components/dashboard'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import {
  homePathForRole,
  navigationItemsForRole,
} from '@/features/navigation'

const iconsByPath = {
  '/app': ChefHatIcon,
  '/app/inventory': WarehouseIcon,
  '/app/purchases': ShoppingBasket01Icon,
  '/app/invoices': Invoice01Icon,
  '/app/dishes': Dish02Icon,
  '/app/shifts': Calendar03Icon,
  '/app/staff': UserGroupIcon,
  '/app/profile': UserIcon,
  '/app/settings': Settings01Icon,
  '/admin': DashboardSquare01Icon,
  '/admin/inventory': WarehouseIcon,
  '/admin/purchases': ShoppingBasket01Icon,
  '/admin/invoices': Invoice01Icon,
  '/admin/dishes': Dish02Icon,
  '/admin/shifts': Calendar03Icon,
  '/admin/staff': UserGroupIcon,
  '/admin/suppliers': Store01Icon,
  '/admin/users': UserGroupIcon,
  '/admin/settings': Settings01Icon,
} as const

function getSidebarDefaultOpen() {
  const persistedState = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith('sidebar_state='))
    ?.slice('sidebar_state='.length)

  return persistedState !== 'false'
}

export function WorkspaceShell({
  children,
  onLogout,
  user,
}: PropsWithChildren<{
  onLogout: () => Promise<void>
  user: UserDto
}>) {
  if (!user.workspace) throw new Error('Workspace shell requires an active membership')
  const role = user.workspace.role
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigationItems = navigationItemsForRole(role)
  const activeItem = navigationItems.find((item) => item.to === pathname)
  const homePath = homePathForRole(role)
  const settingsPath = role === 'chef' ? '/app/settings' : '/admin/settings'
  const items: ReadonlyArray<DashboardNavigationItem> = navigationItems.map((item) => ({
    ...item,
    icon: iconsByPath[item.to],
    isActive: item.to === pathname,
  }))

  return (
    <SidebarProvider defaultOpen={getSidebarDefaultOpen()}>
      <AppSidebar
        accountPath={role === 'chef' ? '/app/profile' : undefined}
        homePath={homePath}
        items={items}
        onLogout={onLogout}
        settingsPath={settingsPath}
        user={user}
        workspaceLabel={workspaceRoleLabel(role)}
      />
      <SidebarInset className="workspace-surface">
        <SiteHeader title={activeItem?.label ?? workspaceRoleLabel(role)} />
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}

function workspaceRoleLabel(role: NonNullable<UserDto['workspace']>['role']) {
  if (role === 'owner') return 'Владелец'
  if (role === 'administrator') return 'Администратор'
  return 'Шеф-повар'
}
