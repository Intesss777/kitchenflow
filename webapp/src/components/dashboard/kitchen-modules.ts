import {
  ChefHatIcon,
  MenuRestaurantIcon,
  PackageOpenIcon,
  ShoppingBasket01Icon,
} from '@hugeicons/core-free-icons'
import type { IconSvgElement } from '@hugeicons/react'

export const kitchenModules: ReadonlyArray<{
  href: '/app/inventory' | '/app/purchases' | '/app/dishes' | '/app/staff'
  icon: IconSvgElement
  title: string
}> = [
  {
    href: '/app/inventory',
    icon: PackageOpenIcon,
    title: 'Склад',
  },
  {
    href: '/app/purchases',
    icon: ShoppingBasket01Icon,
    title: 'Закупка',
  },
  {
    href: '/app/dishes',
    icon: MenuRestaurantIcon,
    title: 'Карты блюд',
  },
  {
    href: '/app/staff',
    icon: ChefHatIcon,
    title: 'Команда',
  },
]
