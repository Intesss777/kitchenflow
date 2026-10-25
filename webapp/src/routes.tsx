import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from '@tanstack/react-router'

import { RootLayout } from './root-layout'

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: lazyRouteComponent(() => import('./pages'), 'NotFoundPage'),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }),
  component: lazyRouteComponent(() => import('./pages'), 'HomePage'),
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  validateSearch: returnToSearch,
  component: lazyRouteComponent(() => import('./pages'), 'LoginPage'),
})

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/signup',
  validateSearch: returnToSearch,
  component: lazyRouteComponent(() => import('./pages'), 'SignupPage'),
})

const forgotPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/forgot-password',
  component: lazyRouteComponent(() => import('./pages'), 'ForgotPasswordPage'),
})

const resetPasswordRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/reset-password',
  component: lazyRouteComponent(() => import('./pages'), 'ResetPasswordPage'),
})

const userWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'userWorkspace',
  component: lazyRouteComponent(() => import('./pages'), 'UserWorkspaceLayout'),
})

const userHomeRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app',
  component: lazyRouteComponent(() => import('./pages'), 'UserHomePage'),
})

const userProfileRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/profile',
  component: lazyRouteComponent(() => import('./pages'), 'UserProfilePage'),
})

const userInventoryRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/inventory',
  component: lazyRouteComponent(() => import('./pages'), 'UserInventoryPage'),
})

const userPurchasesRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/purchases',
  component: lazyRouteComponent(() => import('./pages'), 'UserPurchasesPage'),
})

const userInvoicesRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/invoices',
  component: lazyRouteComponent(() => import('./pages'), 'UserInvoicesPage'),
})

const userDishesRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/dishes',
  component: lazyRouteComponent(() => import('./pages'), 'UserDishesPage'),
})

const userStaffRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/staff',
  component: lazyRouteComponent(() => import('./pages'), 'UserStaffPage'),
})

const userShiftsRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/shifts',
  component: lazyRouteComponent(() => import('./pages'), 'UserShiftsPage'),
})

const userSettingsRoute = createRoute({
  getParentRoute: () => userWorkspaceRoute,
  path: '/app/settings',
  component: lazyRouteComponent(() => import('./pages'), 'UserSettingsPage'),
})

const adminWorkspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'adminWorkspace',
  component: lazyRouteComponent(() => import('./pages'), 'AdminWorkspaceLayout'),
})

const adminDashboardRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin',
  component: lazyRouteComponent(() => import('./pages'), 'AdminDashboardPage'),
})

const adminUsersRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/users',
  component: lazyRouteComponent(() => import('./pages'), 'AdminUsersPage'),
})

const adminInventoryRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/inventory',
  component: lazyRouteComponent(() => import('./pages'), 'AdminInventoryPage'),
})

const adminPurchasesRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/purchases',
  component: lazyRouteComponent(() => import('./pages'), 'AdminPurchasesPage'),
})

const adminInvoicesRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/invoices',
  component: lazyRouteComponent(() => import('./pages'), 'AdminInvoicesPage'),
})

const adminDishesRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/dishes',
  component: lazyRouteComponent(() => import('./pages'), 'AdminDishesPage'),
})

const adminStaffRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/staff',
  component: lazyRouteComponent(() => import('./pages'), 'AdminStaffPage'),
})

const adminShiftsRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/shifts',
  component: lazyRouteComponent(() => import('./pages'), 'AdminShiftsPage'),
})

const adminSuppliersRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/suppliers',
  component: lazyRouteComponent(() => import('./pages'), 'AdminSuppliersPage'),
})

const adminSettingsRoute = createRoute({
  getParentRoute: () => adminWorkspaceRoute,
  path: '/admin/settings',
  component: lazyRouteComponent(() => import('./pages'), 'AdminSettingsPage'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  forgotPasswordRoute,
  resetPasswordRoute,
  userWorkspaceRoute.addChildren([
    userHomeRoute,
    userInventoryRoute,
    userPurchasesRoute,
    userInvoicesRoute,
    userDishesRoute,
    userShiftsRoute,
    userStaffRoute,
    userProfileRoute,
    userSettingsRoute,
  ]),
  adminWorkspaceRoute.addChildren([
    adminDashboardRoute,
    adminInventoryRoute,
    adminPurchasesRoute,
    adminInvoicesRoute,
    adminDishesRoute,
    adminShiftsRoute,
    adminStaffRoute,
    adminSuppliersRoute,
    adminUsersRoute,
    adminSettingsRoute,
  ]),
])

export const router = createRouter({ routeTree })

function returnToSearch(search: Record<string, unknown>) {
  return {
    returnTo: typeof search.returnTo === 'string' ? search.returnTo : undefined,
  }
}

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
