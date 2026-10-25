import { Calendar03Icon, UserCircle02Icon } from '@hugeicons/core-free-icons'
import type { UserDto } from '@kitchenflow/contracts'

import { SectionCards } from '@/components/dashboard'
import { formatDate } from '@/platform/intl'

export function AccountSummary({ user }: { user: UserDto }) {
  return (
    <SectionCards
      items={[
        {
          description: user.email,
          icon: UserCircle02Icon,
          label: 'Профиль',
          value: user.displayName ?? 'Имя не указано',
        },
        {
          description: `Роль в KitchenFlow: ${formatRole(user.workspace?.role)}`,
          icon: Calendar03Icon,
          label: 'В системе с',
          value: formatDate(user.createdAt),
        },
      ]}
    />
  )
}

function formatRole(role: NonNullable<UserDto['workspace']>['role'] | undefined) {
  if (role === 'owner') return 'Владелец'
  if (role === 'administrator') return 'Администратор'
  if (role === 'chef') return 'Шеф-повар'
  return 'Доступ не настроен'
}
