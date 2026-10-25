import { Outlet, useLocation, useRouter, useSearch } from '@tanstack/react-router'
import type { UserDto, WorkspaceRole } from '@kitchenflow/contracts'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import {
  NotFoundSection,
  SessionErrorSection,
  SessionLoadingSection,
  WorkspaceUnavailableSection,
} from '@/components/WebRouteSections'
import { WorkspaceShell } from '@/components/WorkspaceShell'
import { AdminDashboard, AdminSettings, AdminUsers } from '@/features/admin'
import {
  AuthPageShell,
  clearPasswordResetTokenHash,
  ForgotPasswordForm,
  LoginForm,
  RegisterForm,
  readPasswordResetToken,
  ResetPasswordForm,
  useAuth,
} from '@/features/auth'
import { homePathForRole, resolveRoleDestination, safeReturnPath } from '@/features/navigation'
import { DishesPage } from '@/features/dishes'
import { InventoryPage } from '@/features/inventory'
import { InvoicesPage } from '@/features/invoices'
import { PurchasesPage } from '@/features/purchases'
import { StaffPage } from '@/features/staff'
import { ShiftsPage } from '@/features/shifts'
import { SuppliersPage } from '@/features/operations'
import { UserHome, UserProfile, UserSettings } from '@/features/users'

export function HomePage() {
  const auth = useAuth()
  const { returnTo } = useSearch({ from: '/' })

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }
  if (auth.user) {
    if (!auth.user.workspace) return <WorkspaceUnavailableSection logout={auth.logout} />
    const role = auth.user.workspace.role
    return (
      <HrefRedirect
        href={safeReturnPath(role, returnTo) ?? homePathForRole(role)}
      />
    )
  }
  const destination = returnTo
    ? `/login?returnTo=${encodeURIComponent(returnTo)}`
    : '/login'
  return <HrefRedirect href={destination} />
}

export function LoginPage() {
  const { returnTo } = useSearch({ from: '/login' })
  return (
    <GuestAuthPage returnTo={returnTo}>
      <AuthPageShell>
        <LoginForm returnTo={returnTo} />
      </AuthPageShell>
    </GuestAuthPage>
  )
}

export function SignupPage() {
  const { returnTo } = useSearch({ from: '/signup' })
  return (
    <GuestAuthPage returnTo={returnTo}>
      <AuthPageShell>
        <RegisterForm returnTo={returnTo} />
      </AuthPageShell>
    </GuestAuthPage>
  )
}

export function ForgotPasswordPage() {
  return (
    <GuestAuthPage>
      <AuthPageShell>
        <ForgotPasswordForm />
      </AuthPageShell>
    </GuestAuthPage>
  )
}

export function ResetPasswordPage() {
  const auth = useAuth()
  const token = usePasswordResetToken()
  if (auth.isBootstrapping) return <SessionLoadingSection />

  return (
    <AuthPageShell>
      <ResetPasswordForm token={token} />
    </AuthPageShell>
  )
}

export function UserHomePage() {
  const user = useWorkspaceUser('chef')
  return <UserHome user={user} />
}

export function UserProfilePage() {
  const user = useWorkspaceUser('chef')
  return <UserProfile user={user} />
}

export function UserInventoryPage() {
  return <InventoryPage />
}

export function UserPurchasesPage() {
  return <PurchasesPage />
}

export function UserInvoicesPage() {
  return <InvoicesPage />
}

export function UserDishesPage() {
  return <DishesPage />
}

export function UserStaffPage() {
  return <StaffPage />
}

export function UserShiftsPage() {
  return <ShiftsPage />
}

export function UserSettingsPage() {
  const auth = useAuth()
  const user = useWorkspaceUser('owner', 'administrator', 'chef')
  return <UserSettings onLogout={auth.logout} user={user} />
}

export function AdminDashboardPage() {
  return <AdminDashboard />
}

export function AdminUsersPage() {
  const user = useWorkspaceUser('owner')
  return <AdminUsers currentUser={user} />
}

export function AdminSuppliersPage() {
  return <SuppliersPage />
}

export function AdminInventoryPage() {
  return <InventoryPage />
}

export function AdminPurchasesPage() {
  return <PurchasesPage />
}

export function AdminInvoicesPage() {
  return <InvoicesPage />
}

export function AdminDishesPage() {
  return <DishesPage />
}

export function AdminStaffPage() {
  return <StaffPage />
}

export function AdminShiftsPage() {
  return <ShiftsPage />
}

export function AdminSettingsPage() {
  const user = useWorkspaceUser('owner', 'administrator')
  return <AdminSettings user={user} />
}

export function UserWorkspaceLayout() {
  return <WorkspaceRoute surface="app" />
}

export function AdminWorkspaceLayout() {
  return <WorkspaceRoute surface="admin" />
}

export function NotFoundPage() {
  const auth = useAuth()

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }

  if (auth.user && !auth.user.workspace) {
    return <WorkspaceUnavailableSection logout={auth.logout} />
  }
  const destination = auth.user?.workspace
    ? homePathForRole(auth.user.workspace.role)
    : '/login'
  return <NotFoundSection destination={destination} />
}

function WorkspaceRoute({ surface }: { surface: 'admin' | 'app' }) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }
  if (!auth.user) {
    const returnTo = `${location.pathname}${location.searchStr}`
    return <HrefRedirect href={`/login?returnTo=${encodeURIComponent(returnTo)}`} />
  }
  if (!auth.user.workspace) {
    return <WorkspaceUnavailableSection logout={auth.logout} />
  }
  const role = auth.user.workspace.role
  const destination = resolveRoleDestination(role, location.pathname)
  if (destination !== location.pathname || (surface === 'app') !== (role === 'chef')) {
    return <HrefRedirect href={destination} />
  }

  return (
    <WorkspaceShell onLogout={auth.logout} user={auth.user}>
      <Outlet />
    </WorkspaceShell>
  )
}

function GuestAuthPage({
  children,
  returnTo,
}: {
  children: ReactNode
  returnTo?: string
}) {
  const auth = useAuth()

  if (auth.isBootstrapping) return <SessionLoadingSection />
  if (auth.sessionError && !auth.user) {
    return <SessionErrorSection retry={auth.retrySession} />
  }
  if (auth.user) {
    if (!auth.user.workspace) return <WorkspaceUnavailableSection logout={auth.logout} />
    const role = auth.user.workspace.role
    return (
      <HrefRedirect
        href={safeReturnPath(role, returnTo) ?? homePathForRole(role)}
      />
    )
  }

  return children
}

function usePasswordResetToken() {
  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') return ''
    return readPasswordResetToken(window.location)
  })

  useEffect(() => {
    const captureToken = () => {
      const nextToken = readPasswordResetToken(window.location)
      if (!nextToken) return
      setToken(nextToken)
      clearPasswordResetTokenHash(window.location, window.history)
    }

    captureToken()
    window.addEventListener('hashchange', captureToken)
    return () => window.removeEventListener('hashchange', captureToken)
  }, [])

  return token
}

function useWorkspaceUser(...roles: ReadonlyArray<WorkspaceRole>): UserDto {
  const user = useAuth().user
  if (!user?.workspace || !roles.includes(user.workspace.role)) {
    throw new Error(`${roles.join('/')} workspace page rendered outside its guarded layout`)
  }
  return user
}

function HrefRedirect({ href }: { href: string }) {
  const router = useRouter()
  const hasRedirected = useRef(false)
  useEffect(() => {
    if (hasRedirected.current) return
    hasRedirected.current = true
    router.history.replace(href)
  }, [href, router])
  return null
}
