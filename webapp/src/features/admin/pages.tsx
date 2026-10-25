import type { UserDto } from '@kitchenflow/contracts'

import { PageContainer, PageHeader } from '@/components/PageLayout'
import { AppearancePanel, InstallAppPanel } from '@/features/settings'
import { CredentialsPanel, ProfilePanel } from '@/features/users'
import { BranchManagementPanel } from '@/features/workspace'
import { AdminMetrics } from './AdminMetrics'
import { UserDirectory } from './UserDirectory'

export function AdminDashboard() {
  return (
    <PageContainer>
      <AdminMetrics />
    </PageContainer>
  )
}

export function AdminUsers({ currentUser }: { currentUser: UserDto }) {
  return (
    <PageContainer>
      <PageHeader
        title="Доступы"
      />
      <UserDirectory currentUser={currentUser} />
    </PageContainer>
  )
}

export function AdminSettings({ user }: { user: UserDto }) {
  return (
    <PageContainer>
      <PageHeader
        title="Настройки"
      />
      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <ProfilePanel user={user} />
        <CredentialsPanel user={user} />
        <AppearancePanel />
        {user.workspace?.role === 'owner' && <BranchManagementPanel />}
        <InstallAppPanel />
      </div>
    </PageContainer>
  )
}
