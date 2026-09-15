import prisma from '@/lib/prisma';
import type { BusinessSnapshot } from './types';

const LOW_STOCK_TAKE = 10;

export async function buildBusinessSnapshot(opts: {
  lowStockThreshold: number;
  fastSellingStockMultiplier: number;
  abandonedCartIdleMinutes: number;
  pendingOrderThresholdHours: number;
}): Promise<BusinessSnapshot> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);

  const [
    totalOrders,
    totalProducts,
    totalCustomers,
    revenue30dAgg,
    pendingCount,
    oldestPending,
    failedPaymentCount,
    allProducts,
    recentOrderItems,
    abandonedActive,
    abandonedFlagged,
    abandonedRecovered,
    recoveryCandidates,
    customerRows,
    newCustomers7d,
    todayOrders,
    todayRevenueAgg,
    todayVisitorRows,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.product.count(),
    prisma.customer.count(),
    prisma.order.aggregate({
      where: { createdAt: { gte: thirtyDaysAgo }, OR: [{ paymentStatus: 'PAID' }, { paymentStatus: 'COD' }] },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({ where: { status: 'PENDING' } }),
    prisma.order.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }),
    prisma.order.count({ where: { paymentStatus: 'FAILED' } }),
    prisma.product.findMany({
      select: { id: true, name: true, stock: true, status: true, createdAt: true },
    }),
    prisma.orderItem.findMany({
      where: { order: { createdAt: { gte: fourteenDaysAgo } } },
      select: { productId: true, name: true, quantity: true, price: true },
    }),
    prisma.abandonedCart.count({ where: { status: 'ACTIVE' } }),
    prisma.abandonedCart.count({ where: { status: 'ABANDONED' } }),
    prisma.abandonedCart.count({ where: { status: 'RECOVERED' } }),
    prisma.abandonedCart.findMany({
      where: {
        OR: [
          { status: 'ABANDONED', recoveryStatus: 'NOT_CONTACTED' },
          { status: 'ABANDONED', recoveryStatus: 'CONTACTED' },
        ],
      },
      orderBy: { lastActiveAt: 'asc' },
      take: 10,
      select: {
        id: true,
        cartToken: true,
        cartValue: true,
        lastActiveAt: true,
        customerPhone: true,
        items: true,
        contactCount: true,
      },
    }),
    prisma.customer.findMany({
      select: { id: true, customerType: true, totalOrders: true, totalSpent: true, lastOrderAt: true, createdAt: true },
    }),
    prisma.customer.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.order.aggregate({
      where: { createdAt: { gte: startOfToday }, OR: [{ paymentStatus: 'PAID' }, { paymentStatus: 'COD' }] },
      _sum: { totalAmount: true },
    }),
    prisma.visitorSession.findMany({
      where: { createdAt: { gte: startOfToday } },
      select: { visitorId: true },
    }),
  ]);

  const lowStock: BusinessSnapshot['lowStock'] = [];
  const outOfStock: BusinessSnapshot['outOfStock'] = [];
  for (const p of allProducts) {
    if (p.status !== 'ACTIVE') continue;
    if (p.stock === 0) outOfStock.push({ id: p.id, name: p.name });
    else if (p.stock <= opts.lowStockThreshold) lowStock.push({ id: p.id, name: p.name, stock: p.stock });
  }
  lowStock.sort((a, b) => a.stock - b.stock);

  const sold14dMap = new Map<string, { name: string; sold: number; revenue: number }>();
  for (const item of recentOrderItems) {
    const entry = sold14dMap.get(item.productId) || { name: item.name, sold: 0, revenue: 0 };
    entry.sold += item.quantity;
    entry.revenue += item.price * item.quantity;
    sold14dMap.set(item.productId, entry);
  }

  const productById = new Map(allProducts.map((p) => [p.id, p]));
  const fastSelling: BusinessSnapshot['fastSelling'] = [];
  for (const [productId, entry] of Array.from(sold14dMap.entries())) {
    const product = productById.get(productId);
    if (!product || product.status !== 'ACTIVE') continue;
    const weeklyVelocity = entry.sold / 2;
    if (product.stock <= weeklyVelocity * opts.fastSellingStockMultiplier) {
      fastSelling.push({ id: productId, name: entry.name, sold14d: entry.sold, stock: product.stock });
    }
  }
  fastSelling.sort((a, b) => b.sold14d - a.sold14d);

  const slowMoving: BusinessSnapshot['slowMoving'] = [];
  for (const p of allProducts) {
    if (p.status !== 'ACTIVE') continue;
    if (!sold14dMap.has(p.id)) {
      slowMoving.push({
        id: p.id,
        name: p.name,
        daysSinceLastSale: null,
      });
    }
  }
  slowMoving.sort((a, b) => a.name.localeCompare(b.name));
  const slowMovingTrimmed = slowMoving.slice(0, 10);

  const pendingRecovery = recoveryCandidates
    .map((c) => {
      let itemNames: string[] = [];
      let itemCount = 0;
      try {
        const parsed = JSON.parse(c.items) as Array<{ name?: string; quantity?: number; product?: { name?: string } }>;
        itemCount = parsed.length;
        itemNames = parsed
          .slice(0, 3)
          .map((i) => i.name || i.product?.name || 'item')
          .filter(Boolean);
      } catch {
        itemNames = [];
      }
      return {
        id: c.id,
        cartToken: c.cartToken,
        cartValue: c.cartValue,
        ageMinutes: Math.round((now.getTime() - new Date(c.lastActiveAt).getTime()) / 60000),
        hasPhone: Boolean(c.customerPhone),
        itemCount,
        itemNames,
      };
    })
    .filter((c) => c.ageMinutes >= opts.abandonedCartIdleMinutes);

  let returning = 0;
  let vip = 0;
  let inactive45d = 0;
  let atRisk = 0;
  for (const c of customerRows) {
    if (c.lastOrderAt && new Date(c.lastOrderAt) < fortyFiveDaysAgo) {
      inactive45d++;
      if (c.customerType === 'VIP' || c.customerType === 'RETURNING') atRisk++;
    } else if (c.customerType === 'VIP') vip++;
    else if (c.customerType === 'RETURNING' || c.totalOrders > 1) returning++;
  }

  const oldestPendingHours =
    oldestPending
      ? Math.round((now.getTime() - new Date(oldestPending.createdAt).getTime()) / 3600000)
      : null;

  const topProducts7d = Array.from(sold14dMap.entries())
    .map(([id, e]) => ({ id, name: e.name, sold: Math.round(e.sold / 2), revenue: Math.round(e.revenue / 2) }))
    .sort((a, b) => b.sold - a.sold)
    .slice(0, 5);

  const todayVisitors = new Set(todayVisitorRows.map((v) => v.visitorId)).size;

  return {
    now: now.toISOString(),
    totals: {
      orders: totalOrders,
      products: totalProducts,
      customers: totalCustomers,
      revenue30d: revenue30dAgg._sum.totalAmount || 0,
    },
    pendingOrders: { count: pendingCount, oldestHours: oldestPendingHours },
    failedPayments: { count: failedPaymentCount },
    lowStock: lowStock.slice(0, LOW_STOCK_TAKE),
    outOfStock: outOfStock.slice(0, LOW_STOCK_TAKE),
    fastSelling: fastSelling.slice(0, 5),
    slowMoving: slowMovingTrimmed,
    abandonedCarts: {
      active: abandonedActive,
      abandoned: abandonedFlagged,
      recovered: abandonedRecovered,
      pendingRecovery,
    },
    customers: {
      total: totalCustomers,
      new7d: newCustomers7d,
      returning,
      vip,
      inactive45d,
      atRisk,
    },
    today: {
      orders: todayOrders,
      revenue: todayRevenueAgg._sum.totalAmount || 0,
      visitors: todayVisitors,
      conversionRate:
        todayVisitors > 0 ? Number(((todayOrders / todayVisitors) * 100).toFixed(1)) : 0,
    },
    topProducts7d,
  };
}

export function summarizeSnapshot(s: BusinessSnapshot): string {
  return [
    `Total orders: ${s.totals.orders}; products: ${s.totals.products}; customers: ${s.totals.customers}; revenue last 30 days: INR ${s.totals.revenue30d}`,
    `Today: ${s.today.orders} orders, INR ${s.today.revenue} revenue, ${s.today.visitors} visitors, conversion ${s.today.conversionRate}%`,
    `Pending orders: ${s.pendingOrders.count} (oldest ${s.pendingOrders.oldestHours ?? 'n/a'} hours old)`,
    `Failed payments: ${s.failedPayments.count}`,
    `Low stock (<=threshold): ${s.lowStock.map((p) => `${p.name} (${p.stock} left)`).join(', ') || 'none'}`,
    `Out of stock: ${s.outOfStock.map((p) => p.name).join(', ') || 'none'}`,
    `Fast selling (14-day velocity vs stock): ${s.fastSelling.map((p) => `${p.name} (${p.sold14d} sold, ${p.stock} in stock)`).join(', ') || 'none'}`,
    `No sales in last 14 days: ${s.slowMoving.slice(0, 5).map((p) => p.name).join(', ') || 'none'}`,
    `Abandoned carts: ${s.abandonedCarts.active} active, ${s.abandonedCarts.abandoned} abandoned, ${s.abandonedCarts.recovered} recovered; recovery candidates: ${s.abandonedCarts.pendingRecovery.length}`,
    `Customers: ${s.customers.total} total, ${s.customers.new7d} new (7d), ${s.customers.returning} returning, ${s.customers.vip} VIP, ${s.customers.inactive45d} inactive (45d), ${s.customers.atRisk} at risk`,
    `Top products (7-day): ${s.topProducts7d.map((p) => `${p.name} (${p.sold} sold, INR ${p.revenue})`).join(', ') || 'none sold yet'}`,
  ].join('\n');
}
