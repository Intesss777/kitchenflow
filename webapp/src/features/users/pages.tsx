import type { UserDto } from '@kitchenflow/contracts'

import { KitchenModules } from '@/components/dashboard'
import { PageContainer, PageHeader } from '@/components/PageLayout'
import { AvatarPanel } from '@/features/avatar'
import { AppearancePanel, InstallAppPanel } from '@/features/settings'
import { AccountSummary } from './AccountSummary'
import { CredentialsPanel } from './CredentialsPanel'
import { ProfilePanel } from './ProfilePanel'
import { SessionPanel } from './SessionPanel'

export function UserHome({ user }: { user: UserDto }) {
  return (
    <PageContainer>
      <PageHeader
        description="Быстрый доступ к складу, накладным и картам блюд."
        title={`Добро пожаловать, ${user.displayName ?? user.email}`}
      />
      <KitchenModules />
      <AccountSummary user={user} />
    </PageContainer>
  )
}

export function UserProfile({ user }: { user: UserDto }) {
  return (
    <PageContainer>
      <div className="grid w-full max-w-2xl gap-6">
        <PageHeader
          description="Имя и фото, которые видны в рабочем пространстве."
          title="Профиль"
        />
        <AvatarPanel user={user} />
        <ProfilePanel user={user} />
      </div>
    </PageContainer>
  )
}

export function UserSettings({ onLogout, user }: { onLogout: () => Promise<void>; user: UserDto }) {
  return (
    <PageContainer>
      <PageHeader
        description="Внешний вид приложения и текущая сессия."
        title="Настройки"
      />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AppearancePanel />
        <InstallAppPanel />
        <CredentialsPanel user={user} />
        <SessionPanel onLogout={onLogout} />
      </div>
    </PageContainer>
  )
}
