import type { DbClient } from '../src/db'

const ids = {
  organization: '0199c000-0000-7000-8000-000000000001',
  branch: '0199c000-0000-7000-8000-000000000002',
  terraceBranch: '0199c000-0000-7000-8000-000000000003',
  suppliers: {
    metro: '0199c000-0000-7000-8000-000000000010',
    fresh: '0199c000-0000-7000-8000-000000000011',
    sea: '0199c000-0000-7000-8000-000000000012',
  },
  entries: {
    metroInvoice: '0199c000-0000-7000-8000-000000000020',
    metroPayment: '0199c000-0000-7000-8000-000000000021',
    freshInvoice: '0199c000-0000-7000-8000-000000000022',
    freshPayment: '0199c000-0000-7000-8000-000000000023',
    seaInvoice: '0199c000-0000-7000-8000-000000000024',
  },
  products: {
    salmon: '0199c000-0000-7000-8000-000000000030',
    cheese: '0199c000-0000-7000-8000-000000000031',
    cucumber: '0199c000-0000-7000-8000-000000000032',
    butter: '0199c000-0000-7000-8000-000000000033',
    cream: '0199c000-0000-7000-8000-000000000034',
    container: '0199c000-0000-7000-8000-000000000035',
    ptitim: '0199c000-0000-7000-8000-000000000036',
    asparagus: '0199c000-0000-7000-8000-000000000037',
    peas: '0199c000-0000-7000-8000-000000000038',
    carrotPuree: '0199c000-0000-7000-8000-000000000039',
    duckBreast: '0199c000-0000-7000-8000-00000000003a',
    beet: '0199c000-0000-7000-8000-00000000003b',
    rootPuree: '0199c000-0000-7000-8000-00000000003c',
    berrySauce: '0199c000-0000-7000-8000-00000000003d',
    lambRack: '0199c000-0000-7000-8000-00000000003e',
    zucchini: '0199c000-0000-7000-8000-00000000003f',
    herbBreading: '0199c000-0000-7000-8000-000000000110',
    broccolini: '0199c000-0000-7000-8000-000000000111',
    cauliflower: '0199c000-0000-7000-8000-000000000112',
    cherryTomato: '0199c000-0000-7000-8000-000000000113',
    capers: '0199c000-0000-7000-8000-000000000114',
    peaPuree: '0199c000-0000-7000-8000-000000000115',
  },
  movements: {
    salmonReceipt: '0199c000-0000-7000-8000-000000000040',
    salmonWriteoff: '0199c000-0000-7000-8000-000000000041',
    cheeseReceipt: '0199c000-0000-7000-8000-000000000042',
    cheeseWriteoff: '0199c000-0000-7000-8000-000000000043',
    cucumberReceipt: '0199c000-0000-7000-8000-000000000044',
    butterStocktake: '0199c000-0000-7000-8000-000000000045',
    creamReceipt: '0199c000-0000-7000-8000-000000000046',
    containerReceipt: '0199c000-0000-7000-8000-000000000047',
  },
  invoice: '0199c000-0000-7000-8000-000000000050',
  invoiceItems: {
    salmon: '0199c000-0000-7000-8000-000000000051',
    cucumber: '0199c000-0000-7000-8000-000000000052',
    cream: '0199c000-0000-7000-8000-000000000053',
  },
  dishes: {
    salmonPtitim: '0199c000-0000-7000-8000-000000000060',
    duckBeet: '0199c000-0000-7000-8000-000000000061',
    lambPtitim: '0199c000-0000-7000-8000-000000000062',
    salmonBroccolini: '0199c000-0000-7000-8000-000000000063',
  },
  dishIngredients: {
    salmonPtitimSalmon: '0199c000-0000-7000-8000-000000000070',
    salmonPtitimGrain: '0199c000-0000-7000-8000-000000000071',
    salmonPtitimAsparagus: '0199c000-0000-7000-8000-000000000072',
    salmonPtitimPeas: '0199c000-0000-7000-8000-000000000073',
    salmonPtitimPuree: '0199c000-0000-7000-8000-000000000074',
    salmonPtitimButter: '0199c000-0000-7000-8000-000000000075',
    duckBeetDuck: '0199c000-0000-7000-8000-000000000076',
    duckBeetGrain: '0199c000-0000-7000-8000-000000000077',
    duckBeetBeet: '0199c000-0000-7000-8000-000000000078',
    duckBeetPuree: '0199c000-0000-7000-8000-000000000079',
    duckBeetSauce: '0199c000-0000-7000-8000-00000000007a',
    duckBeetButter: '0199c000-0000-7000-8000-00000000007b',
    lambPtitimLamb: '0199c000-0000-7000-8000-00000000007c',
    lambPtitimGrain: '0199c000-0000-7000-8000-00000000007d',
    lambPtitimZucchini: '0199c000-0000-7000-8000-00000000007e',
    lambPtitimPeas: '0199c000-0000-7000-8000-00000000007f',
    lambPtitimPuree: '0199c000-0000-7000-8000-000000000120',
    lambPtitimBreading: '0199c000-0000-7000-8000-000000000121',
    lambPtitimButter: '0199c000-0000-7000-8000-000000000122',
    salmonBroccoliniSalmon: '0199c000-0000-7000-8000-000000000123',
    salmonBroccoliniGreens: '0199c000-0000-7000-8000-000000000124',
    salmonBroccoliniCauliflower: '0199c000-0000-7000-8000-000000000125',
    salmonBroccoliniTomato: '0199c000-0000-7000-8000-000000000126',
    salmonBroccoliniCream: '0199c000-0000-7000-8000-000000000127',
    salmonBroccoliniButter: '0199c000-0000-7000-8000-000000000128',
    salmonBroccoliniCapers: '0199c000-0000-7000-8000-000000000129',
  },
  purchaseDraft: '0199c000-0000-7000-8000-000000000080',
  purchaseDraftItems: {
    cheese: '0199c000-0000-7000-8000-000000000081',
    butter: '0199c000-0000-7000-8000-000000000082',
  },
  staff: {
    alexey: '0199c000-0000-7000-8000-000000000090',
    marina: '0199c000-0000-7000-8000-000000000091',
    rustam: '0199c000-0000-7000-8000-000000000092',
  },
  staffEvents: {
    alexeyLate: '0199c000-0000-7000-8000-000000000093',
    alexeyFine: '0199c000-0000-7000-8000-000000000094',
    marinaLate: '0199c000-0000-7000-8000-000000000095',
    rustamFine: '0199c000-0000-7000-8000-000000000096',
  },
  salesShift: '0199c000-0000-7000-8000-000000000100',
  salesReceipts: {
    first: '0199c000-0000-7000-8000-000000000101',
    second: '0199c000-0000-7000-8000-000000000102',
    third: '0199c000-0000-7000-8000-000000000103',
  },
  salesShiftLines: {
    salmonPtitim: '0199c000-0000-7000-8000-000000000104',
    duckBeet: '0199c000-0000-7000-8000-000000000105',
    lambPtitim: '0199c000-0000-7000-8000-000000000106',
    salmonBroccolini: '0199c000-0000-7000-8000-000000000107',
  },
} as const

export async function seedKitchenFlowFixtures(
  db: DbClient,
  accounts: { adminEmail: string; userEmail: string },
) {
  const now = new Date()
  const day = (offset: number, hour = 9) =>
    new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + offset,
      hour,
    ))
  const [owner, chef] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { email: accounts.adminEmail }, select: { id: true } }),
    db.user.findUniqueOrThrow({ where: { email: accounts.userEmail }, select: { id: true } }),
  ])

  await db.organization.upsert({
    where: { id: ids.organization },
    create: { id: ids.organization, name: 'KitchenFlow Demo' },
    update: { name: 'KitchenFlow Demo' },
  })
  await db.branch.upsert({
    where: { id: ids.branch },
    create: {
      id: ids.branch,
      organizationId: ids.organization,
      name: 'Основной ресторан',
      address: 'Москва, ул. Тверская, 12',
    },
    update: {
      name: 'Основной ресторан',
      address: 'Москва, ул. Тверская, 12',
      isActive: true,
    },
  })
  await db.branch.upsert({
    where: { id: ids.terraceBranch },
    create: {
      id: ids.terraceBranch,
      organizationId: ids.organization,
      name: 'Летняя веранда',
      address: 'Москва, ул. Тверская, 12',
    },
    update: {
      name: 'Летняя веранда',
      address: 'Москва, ул. Тверская, 12',
      isActive: true,
    },
  })
  await Promise.all([
    db.organizationMembership.upsert({
      where: {
        organizationId_userId: { organizationId: ids.organization, userId: owner.id },
      },
      create: {
        activeBranchId: ids.branch,
        organizationId: ids.organization,
        userId: owner.id,
        role: 'owner',
      },
      update: { activeBranchId: ids.branch, role: 'owner' },
    }),
    db.organizationMembership.upsert({
      where: {
        organizationId_userId: { organizationId: ids.organization, userId: chef.id },
      },
      create: {
        activeBranchId: ids.branch,
        organizationId: ids.organization,
        userId: chef.id,
        role: 'chef',
      },
      update: { activeBranchId: ids.branch, role: 'chef' },
    }),
  ])

  const suppliers = [
    {
      id: ids.suppliers.metro,
      name: 'METRO',
      contactName: 'Отдел HoReCa',
      phone: '+7 495 123-45-67',
      whatsappPhone: '74951234567',
      paymentTermsDays: 14,
    },
    {
      id: ids.suppliers.fresh,
      name: 'Фреш Маркет',
      contactName: 'Анна',
      phone: '+7 916 555-21-40',
      whatsappPhone: '79165552140',
      paymentTermsDays: 7,
    },
    {
      id: ids.suppliers.sea,
      name: 'Море рядом',
      contactName: 'Илья',
      phone: '+7 903 111-07-70',
      whatsappPhone: '79031110770',
      paymentTermsDays: 7,
    },
  ] as const
  for (const supplier of suppliers) {
    await db.supplier.upsert({
      where: { id: supplier.id },
      create: { ...supplier, organizationId: ids.organization },
      update: { ...supplier, isActive: true },
    })
  }

  const entries = [
    {
      id: ids.entries.metroInvoice,
      supplierId: ids.suppliers.metro,
      type: 'invoice' as const,
      amount: '184560.00',
      occurredAt: day(-5, 8),
      dueAt: day(9, 21),
      reference: 'МТ-10482',
      note: 'Накладная: бакалея и молочная продукция',
    },
    {
      id: ids.entries.metroPayment,
      supplierId: ids.suppliers.metro,
      type: 'payment' as const,
      amount: '50000.00',
      occurredAt: day(-2, 11),
      dueAt: null,
      reference: 'Платёж 0810',
      note: 'Частичная оплата',
    },
    {
      id: ids.entries.freshInvoice,
      supplierId: ids.suppliers.fresh,
      type: 'invoice' as const,
      amount: '76340.00',
      occurredAt: day(-9, 7),
      dueAt: day(-2, 21),
      reference: 'ФМ-7831',
      note: 'Овощи, зелень, фрукты',
    },
    {
      id: ids.entries.freshPayment,
      supplierId: ids.suppliers.fresh,
      type: 'payment' as const,
      amount: '30000.00',
      occurredAt: day(-4, 14),
      dueAt: null,
      reference: 'Платёж 0610',
      note: 'Частичная оплата',
    },
    {
      id: ids.entries.seaInvoice,
      supplierId: ids.suppliers.sea,
      type: 'invoice' as const,
      amount: '112800.00',
      occurredAt: day(-1, 6),
      dueAt: day(6, 21),
      reference: 'МР-2240',
      note: 'Рыба и морепродукты',
    },
  ]
  for (const entry of entries) {
    await db.supplierLedgerEntry.upsert({
      where: { id: entry.id },
      create: {
        ...entry,
        organizationId: ids.organization,
        branchId: ids.branch,
      },
      update: entry,
    })
  }

  const products = [
    {
      id: ids.products.salmon,
      name: 'Лосось филе',
      category: 'Рыба и морепродукты',
      unit: 'kilogram' as const,
      minimumQuantity: '4.000',
      unitCost: '1450.00',
      quantity: '6.800',
    },
    {
      id: ids.products.cheese,
      name: 'Сыр сливочный',
      category: 'Молочные продукты',
      unit: 'kilogram' as const,
      minimumQuantity: '5.000',
      unitCost: '760.00',
      quantity: '3.200',
    },
    {
      id: ids.products.cucumber,
      name: 'Огурцы свежие',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '6.000',
      unitCost: '190.00',
      quantity: '11.500',
    },
    {
      id: ids.products.butter,
      name: 'Масло сливочное',
      category: 'Молочные продукты',
      unit: 'kilogram' as const,
      minimumQuantity: '2.500',
      unitCost: '890.00',
      quantity: '1.800',
    },
    {
      id: ids.products.cream,
      name: 'Сливки 33%',
      category: 'Молочные продукты',
      unit: 'liter' as const,
      minimumQuantity: '4.000',
      unitCost: '460.00',
      quantity: '8.000',
    },
    {
      id: ids.products.container,
      name: 'Контейнер 750 мл',
      category: 'Упаковка',
      unit: 'piece' as const,
      minimumQuantity: '50.000',
      unitCost: '19.50',
      quantity: '82.000',
    },
    {
      id: ids.products.ptitim,
      name: 'Птитим',
      category: 'Крупы и паста',
      unit: 'kilogram' as const,
      minimumQuantity: '2.000',
      unitCost: '280.00',
      quantity: '8.000',
    },
    {
      id: ids.products.asparagus,
      name: 'Спаржа зелёная',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '1.000',
      unitCost: '950.00',
      quantity: '3.000',
    },
    {
      id: ids.products.peas,
      name: 'Горошек зелёный',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '2.000',
      unitCost: '320.00',
      quantity: '6.000',
    },
    {
      id: ids.products.carrotPuree,
      name: 'Пюре морковное',
      category: 'Заготовки',
      unit: 'kilogram' as const,
      minimumQuantity: '1.000',
      unitCost: '240.00',
      quantity: '2.500',
    },
    {
      id: ids.products.duckBreast,
      name: 'Утиная грудка',
      category: 'Мясо и птица',
      unit: 'kilogram' as const,
      minimumQuantity: '1.500',
      unitCost: '1350.00',
      quantity: '4.000',
    },
    {
      id: ids.products.beet,
      name: 'Свёкла',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '2.000',
      unitCost: '120.00',
      quantity: '8.000',
    },
    {
      id: ids.products.rootPuree,
      name: 'Пюре из корнеплодов',
      category: 'Заготовки',
      unit: 'kilogram' as const,
      minimumQuantity: '1.000',
      unitCost: '260.00',
      quantity: '3.000',
    },
    {
      id: ids.products.berrySauce,
      name: 'Соус ягодный',
      category: 'Соусы и заготовки',
      unit: 'kilogram' as const,
      minimumQuantity: '0.500',
      unitCost: '520.00',
      quantity: '2.000',
    },
    {
      id: ids.products.lambRack,
      name: 'Каре ягнёнка',
      category: 'Мясо и птица',
      unit: 'kilogram' as const,
      minimumQuantity: '1.500',
      unitCost: '2300.00',
      quantity: '3.500',
    },
    {
      id: ids.products.zucchini,
      name: 'Цукини',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '2.000',
      unitCost: '260.00',
      quantity: '7.000',
    },
    {
      id: ids.products.herbBreading,
      name: 'Панировка с травами',
      category: 'Заготовки',
      unit: 'kilogram' as const,
      minimumQuantity: '0.500',
      unitCost: '380.00',
      quantity: '2.000',
    },
    {
      id: ids.products.broccolini,
      name: 'Брокколини',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '1.500',
      unitCost: '850.00',
      quantity: '4.000',
    },
    {
      id: ids.products.cauliflower,
      name: 'Капуста цветная',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '2.000',
      unitCost: '240.00',
      quantity: '6.000',
    },
    {
      id: ids.products.cherryTomato,
      name: 'Томаты черри',
      category: 'Овощи и зелень',
      unit: 'kilogram' as const,
      minimumQuantity: '1.000',
      unitCost: '480.00',
      quantity: '4.000',
    },
    {
      id: ids.products.capers,
      name: 'Каперсы',
      category: 'Соусы и заготовки',
      unit: 'kilogram' as const,
      minimumQuantity: '0.300',
      unitCost: '1200.00',
      quantity: '1.000',
    },
    {
      id: ids.products.peaPuree,
      name: 'Пюре из зелёного горошка',
      category: 'Заготовки',
      unit: 'kilogram' as const,
      minimumQuantity: '1.000',
      unitCost: '360.00',
      quantity: '2.500',
    },
  ]
  for (const product of products) {
    await db.inventoryProduct.upsert({
      where: { id: product.id },
      create: {
        id: product.id,
        organizationId: ids.organization,
        name: product.name,
        category: product.category,
        unit: product.unit,
        minimumQuantity: product.minimumQuantity,
        unitCost: product.unitCost,
      },
      update: {
        name: product.name,
        category: product.category,
        unit: product.unit,
        minimumQuantity: product.minimumQuantity,
        unitCost: product.unitCost,
        isActive: true,
      },
    })
    await db.inventoryBalance.upsert({
      where: {
        branchId_productId: { branchId: ids.branch, productId: product.id },
      },
      create: {
        branchId: ids.branch,
        productId: product.id,
        quantity: product.quantity,
      },
      update: { quantity: product.quantity },
    })
  }

  const purchaseDraft = await db.purchaseDraft.upsert({
    where: { branchId: ids.branch },
    create: {
      id: ids.purchaseDraft,
      organizationId: ids.organization,
      branchId: ids.branch,
      supplierId: ids.suppliers.metro,
      updatedByUserId: chef.id,
    },
    update: {
      supplierId: ids.suppliers.metro,
      updatedByUserId: chef.id,
      note: null,
    },
    select: { id: true },
  })
  await db.purchaseDraftItem.deleteMany({ where: { draftId: purchaseDraft.id } })
  await db.purchaseDraftItem.createMany({
    data: [
      {
        id: ids.purchaseDraftItems.cheese,
        draftId: purchaseDraft.id,
        productId: ids.products.cheese,
        requestedQuantity: '3.000',
      },
      {
        id: ids.purchaseDraftItems.butter,
        draftId: purchaseDraft.id,
        productId: ids.products.butter,
        requestedQuantity: '2.000',
      },
    ],
  })

  const staff = [
    { id: ids.staff.alexey, name: 'Алексей Смирнов', position: 'Су-шеф' },
    { id: ids.staff.marina, name: 'Марина Волкова', position: 'Повар горячего цеха' },
    { id: ids.staff.rustam, name: 'Рустам Алиев', position: 'Заготовщик' },
  ]
  for (const employee of staff) {
    await db.staffEmployee.upsert({
      where: { id: employee.id },
      create: { ...employee, organizationId: ids.organization, branchId: ids.branch },
      update: { name: employee.name, position: employee.position, isActive: true },
    })
  }
  const staffEvents = [
    {
      id: ids.staffEvents.alexeyLate,
      employeeId: ids.staff.alexey,
      type: 'lateness' as const,
      occurredOn: day(-3),
      arrivalTime: '10:18',
      fineAmount: null,
      reason: 'Опоздал на утреннюю смену',
    },
    {
      id: ids.staffEvents.alexeyFine,
      employeeId: ids.staff.alexey,
      type: 'fine' as const,
      occurredOn: day(-2),
      arrivalTime: null,
      fineAmount: '1500.00',
      reason: 'Не предупредил о замене смены',
    },
    {
      id: ids.staffEvents.marinaLate,
      employeeId: ids.staff.marina,
      type: 'lateness' as const,
      occurredOn: day(-1),
      arrivalTime: '09:24',
      fineAmount: null,
      reason: 'Задержалась в дороге',
    },
    {
      id: ids.staffEvents.rustamFine,
      employeeId: ids.staff.rustam,
      type: 'fine' as const,
      occurredOn: day(0),
      arrivalTime: null,
      fineAmount: '500.00',
      reason: 'Не убрал рабочее место после смены',
    },
  ]
  for (const event of staffEvents) {
    await db.staffEvent.upsert({
      where: { id: event.id },
      create: {
        ...event,
        organizationId: ids.organization,
        branchId: ids.branch,
        createdByUserId: chef.id,
      },
      update: event,
    })
  }

  const movements = [
    {
      id: ids.movements.salmonReceipt,
      productId: ids.products.salmon,
      type: 'receipt' as const,
      quantityDelta: '9.500',
      resultingQuantity: '9.500',
      unitCost: '1450.00',
      occurredAt: day(-1, 7),
      reference: 'МР-2240',
      note: 'Поставка по накладной',
    },
    {
      id: ids.movements.salmonWriteoff,
      productId: ids.products.salmon,
      type: 'writeoff' as const,
      quantityDelta: '-2.700',
      resultingQuantity: '6.800',
      unitCost: null,
      occurredAt: day(0, 18),
      reference: null,
      note: 'Расход за смену',
    },
    {
      id: ids.movements.cheeseReceipt,
      productId: ids.products.cheese,
      type: 'receipt' as const,
      quantityDelta: '6.000',
      resultingQuantity: '6.000',
      unitCost: '760.00',
      occurredAt: day(-2, 8),
      reference: 'МТ-10482',
      note: 'Поставка по накладной',
    },
    {
      id: ids.movements.cheeseWriteoff,
      productId: ids.products.cheese,
      type: 'writeoff' as const,
      quantityDelta: '-2.800',
      resultingQuantity: '3.200',
      unitCost: null,
      occurredAt: day(0, 17),
      reference: null,
      note: 'Расход за смену',
    },
    {
      id: ids.movements.cucumberReceipt,
      productId: ids.products.cucumber,
      type: 'receipt' as const,
      quantityDelta: '11.500',
      resultingQuantity: '11.500',
      unitCost: '190.00',
      occurredAt: day(0, 7),
      reference: 'ФМ-7831',
      note: 'Утренняя поставка',
    },
    {
      id: ids.movements.butterStocktake,
      productId: ids.products.butter,
      type: 'stocktake' as const,
      quantityDelta: '-0.300',
      resultingQuantity: '1.800',
      unitCost: null,
      occurredAt: day(0, 19),
      reference: null,
      note: 'Вечерний пересчёт',
    },
    {
      id: ids.movements.creamReceipt,
      productId: ids.products.cream,
      type: 'receipt' as const,
      quantityDelta: '8.000',
      resultingQuantity: '8.000',
      unitCost: '460.00',
      occurredAt: day(0, 7),
      reference: 'МТ-10482',
      note: 'Утренняя поставка',
    },
    {
      id: ids.movements.containerReceipt,
      productId: ids.products.container,
      type: 'receipt' as const,
      quantityDelta: '100.000',
      resultingQuantity: '100.000',
      unitCost: '19.50',
      occurredAt: day(-3, 10),
      reference: 'УП-320',
      note: 'Поставка упаковки',
    },
  ]
  for (const movement of movements) {
    await db.inventoryMovement.upsert({
      where: { id: movement.id },
      create: {
        ...movement,
        organizationId: ids.organization,
        branchId: ids.branch,
        createdByUserId: chef.id,
      },
      update: movement,
    })
  }

  const dishes = [
    {
      id: ids.dishes.salmonPtitim,
      name: 'Лосось с птитимом и спаржей',
      category: 'Горячее',
      photoPath: '/dishes/salmon-ptitim.jpeg',
      sellingPrice: '1690.00',
      ingredients: [
        { id: ids.dishIngredients.salmonPtitimSalmon, productId: ids.products.salmon, quantity: '0.180' },
        { id: ids.dishIngredients.salmonPtitimGrain, productId: ids.products.ptitim, quantity: '0.070' },
        { id: ids.dishIngredients.salmonPtitimAsparagus, productId: ids.products.asparagus, quantity: '0.070' },
        { id: ids.dishIngredients.salmonPtitimPeas, productId: ids.products.peas, quantity: '0.040' },
        { id: ids.dishIngredients.salmonPtitimPuree, productId: ids.products.carrotPuree, quantity: '0.060' },
        { id: ids.dishIngredients.salmonPtitimButter, productId: ids.products.butter, quantity: '0.015' },
      ],
    },
    {
      id: ids.dishes.duckBeet,
      name: 'Утиная грудка со свёклой',
      category: 'Горячее',
      photoPath: '/dishes/duck-beet.jpeg',
      sellingPrice: '1790.00',
      ingredients: [
        { id: ids.dishIngredients.duckBeetDuck, productId: ids.products.duckBreast, quantity: '0.200' },
        { id: ids.dishIngredients.duckBeetGrain, productId: ids.products.ptitim, quantity: '0.070' },
        { id: ids.dishIngredients.duckBeetBeet, productId: ids.products.beet, quantity: '0.080' },
        { id: ids.dishIngredients.duckBeetPuree, productId: ids.products.rootPuree, quantity: '0.100' },
        { id: ids.dishIngredients.duckBeetSauce, productId: ids.products.berrySauce, quantity: '0.040' },
        { id: ids.dishIngredients.duckBeetButter, productId: ids.products.butter, quantity: '0.015' },
      ],
    },
    {
      id: ids.dishes.lambPtitim,
      name: 'Каре ягнёнка с птитимом',
      category: 'Горячее',
      photoPath: '/dishes/lamb-ptitim.jpeg',
      sellingPrice: '2390.00',
      ingredients: [
        { id: ids.dishIngredients.lambPtitimLamb, productId: ids.products.lambRack, quantity: '0.220' },
        { id: ids.dishIngredients.lambPtitimGrain, productId: ids.products.ptitim, quantity: '0.070' },
        { id: ids.dishIngredients.lambPtitimZucchini, productId: ids.products.zucchini, quantity: '0.090' },
        { id: ids.dishIngredients.lambPtitimPeas, productId: ids.products.peas, quantity: '0.040' },
        { id: ids.dishIngredients.lambPtitimPuree, productId: ids.products.peaPuree, quantity: '0.060' },
        { id: ids.dishIngredients.lambPtitimBreading, productId: ids.products.herbBreading, quantity: '0.020' },
        { id: ids.dishIngredients.lambPtitimButter, productId: ids.products.butter, quantity: '0.015' },
      ],
    },
    {
      id: ids.dishes.salmonBroccolini,
      name: 'Лосось с брокколини',
      category: 'Горячее',
      photoPath: '/dishes/salmon-broccolini.jpeg',
      sellingPrice: '1790.00',
      ingredients: [
        { id: ids.dishIngredients.salmonBroccoliniSalmon, productId: ids.products.salmon, quantity: '0.180' },
        { id: ids.dishIngredients.salmonBroccoliniGreens, productId: ids.products.broccolini, quantity: '0.090' },
        { id: ids.dishIngredients.salmonBroccoliniCauliflower, productId: ids.products.cauliflower, quantity: '0.100' },
        { id: ids.dishIngredients.salmonBroccoliniTomato, productId: ids.products.cherryTomato, quantity: '0.060' },
        { id: ids.dishIngredients.salmonBroccoliniCream, productId: ids.products.cream, quantity: '0.070' },
        { id: ids.dishIngredients.salmonBroccoliniButter, productId: ids.products.butter, quantity: '0.015' },
        { id: ids.dishIngredients.salmonBroccoliniCapers, productId: ids.products.capers, quantity: '0.010' },
      ],
    },
  ] as const
  await db.dishIngredient.deleteMany({
    where: { dishId: { in: dishes.map((dish) => dish.id) } },
  })
  for (const dish of dishes) {
    await db.dishCard.upsert({
      where: { id: dish.id },
      create: {
        id: dish.id,
        organizationId: ids.organization,
        branchId: ids.branch,
        createdByUserId: chef.id,
        name: dish.name,
        category: dish.category,
        photoPath: dish.photoPath,
        sellingPrice: dish.sellingPrice,
      },
      update: {
        name: dish.name,
        category: dish.category,
        photoPath: dish.photoPath,
        photoObjectKey: null,
        sellingPrice: dish.sellingPrice,
        isActive: true,
      },
    })
    await db.dishIngredient.createMany({
      data: dish.ingredients.map((ingredient, position) => ({ ...ingredient, dishId: dish.id, position })),
    })
  }

  const salesShift = await db.salesShift.upsert({
    where: { id: ids.salesShift },
    create: {
      id: ids.salesShift,
      organizationId: ids.organization,
      branchId: ids.branch,
      createdByUserId: chef.id,
      shiftDate: day(0),
    },
    update: {
      shiftDate: day(0),
      status: 'review',
      confirmedByUserId: null,
      confirmedAt: null,
    },
    select: { id: true },
  })
  for (const receipt of [
    { id: ids.salesReceipts.first, suffix: '01' },
    { id: ids.salesReceipts.second, suffix: '02' },
    { id: ids.salesReceipts.third, suffix: '03' },
  ]) {
    await db.salesReceipt.upsert({
      where: { id: receipt.id },
      create: {
        id: receipt.id,
        shiftId: salesShift.id,
        createdByUserId: chef.id,
        status: 'recognized',
        objectKey: `sales-receipts/demo-${receipt.suffix}.jpg`,
        contentType: 'image/jpeg',
        byteSize: 2048,
        uploadExpiresAt: day(1),
        recognitionConfidence: '0.8200',
        recognizedAt: day(0, 22),
      },
      update: {
        status: 'recognized',
        recognitionConfidence: '0.8200',
        recognizedAt: day(0, 22),
      },
    })
  }
  const salesShiftLines = [
    { id: ids.salesShiftLines.salmonPtitim, dishId: ids.dishes.salmonPtitim, position: 0, quantity: 12 },
    { id: ids.salesShiftLines.duckBeet, dishId: ids.dishes.duckBeet, position: 1, quantity: 8 },
    { id: ids.salesShiftLines.lambPtitim, dishId: ids.dishes.lambPtitim, position: 2, quantity: 6 },
    { id: ids.salesShiftLines.salmonBroccolini, dishId: ids.dishes.salmonBroccolini, position: 3, quantity: 10 },
  ]
  await db.salesShiftLine.deleteMany({ where: { shiftId: salesShift.id } })
  await db.salesShiftLine.createMany({
    data: salesShiftLines.map((line) => ({ ...line, shiftId: salesShift.id })),
  })

  const demoInvoice = await db.purchaseInvoice.findUnique({
    where: { id: ids.invoice },
    select: { status: true },
  })
  if (!demoInvoice) {
    await db.purchaseInvoice.create({
      data: {
        id: ids.invoice,
        organizationId: ids.organization,
        branchId: ids.branch,
        supplierId: ids.suppliers.metro,
        createdByUserId: chef.id,
        status: 'review',
        recognitionMode: 'demo',
        recognitionConfidence: '0.8600',
        objectKey: 'purchase-invoices/2026/10/0199c000-demo-invoice',
        contentType: 'image/jpeg',
        byteSize: 482100,
        uploadExpiresAt: day(1, 23),
        invoiceNumber: 'МТ-12041',
        invoiceDate: day(0, 0),
        dueAt: day(14, 0),
        totalAmount: '8055.00',
        recognizedAt: day(0, 8),
        items: {
          create: [
            {
              id: ids.invoiceItems.salmon,
              productId: ids.products.salmon,
              position: 0,
              detectedName: 'Лосось филе',
              unit: 'kilogram',
              quantity: '3.500',
              unitPrice: '1450.00',
              lineTotal: '5075.00',
            },
            {
              id: ids.invoiceItems.cucumber,
              productId: ids.products.cucumber,
              position: 1,
              detectedName: 'Огурцы свежие',
              unit: 'kilogram',
              quantity: '6.000',
              unitPrice: '190.00',
              lineTotal: '1140.00',
            },
            {
              id: ids.invoiceItems.cream,
              productId: ids.products.cream,
              position: 2,
              detectedName: 'Сливки 33%',
              unit: 'liter',
              quantity: '4.000',
              unitPrice: '460.00',
              lineTotal: '1840.00',
            },
          ],
        },
      },
    })
  }

  return { organizationId: ids.organization }
}
