import prisma from '@/lib/prisma';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { sendPushNotification } from '@/lib/web-push';
import { generateBusinessReport } from '@/lib/ai-business';
import type { JsonInput } from './types';

export interface ToolContext {
  /** agent executions always run under the internal system identity */
  actor: string;
}

export interface ToolResult {
  ok: boolean;
  detail: string;
  data?: JsonInput;
}

type ToolHandler = (input: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function num(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const VALID_ORDER_STATUSES = [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
];

export const tools: Record<string, { description: string; execute: ToolHandler }> = {
  getOrders: {
    description: 'Read orders with optional status/payment filters',
    execute: async (input) => {
      const status = str(input.status);
      const paymentStatus = str(input.paymentStatus);
      const sinceDays = clamp(num(input.sinceDays) ?? 30, 1, 365);
      const limit = clamp(num(input.limit) ?? 20, 1, 50);
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      const orders = await prisma.order.findMany({
        where: {
          createdAt: { gte: since },
          ...(status ? { status } : {}),
          ...(paymentStatus ? { paymentStatus } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true, orderId: true, customerName: true, status: true, paymentStatus: true,
          paymentMethod: true, totalAmount: true, createdAt: true,
        },
      });
      return { ok: true, detail: `Fetched ${orders.length} orders`, data: { orders } };
    },
  },

  getOrder: {
    description: 'Read a single order with items',
    execute: async (input) => {
      const id = str(input.id);
      const orderId = str(input.orderId);
      if (!id && !orderId) return { ok: false, detail: 'id or orderId required' };
      const order = await prisma.order.findUnique({
        where: id ? { id } : { orderId: orderId as string },
        include: { items: true },
      });
      if (!order) return { ok: false, detail: 'Order not found' };
      return { ok: true, detail: `Order ${order.orderId} fetched`, data: { order } };
    },
  },

  getProducts: {
    description: 'Read products with optional category/status filters',
    execute: async (input) => {
      const category = str(input.category);
      const status = str(input.status) || 'ACTIVE';
      const limit = clamp(num(input.limit) ?? 50, 1, 100);
      const products = await prisma.product.findMany({
        where: { ...(category ? { category } : {}), ...(status ? { status } : {}) },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true, name: true, slug: true, category: true, stock: true,
          originalPrice: true, salePrice: true, status: true, isBestSeller: true, isFeatured: true,
        },
      });
      return { ok: true, detail: `Fetched ${products.length} products`, data: { products } };
    },
  },

  getProduct: {
    description: 'Read a single product by id or slug',
    execute: async (input) => {
      const id = str(input.id);
      const slug = str(input.slug);
      if (!id && !slug) return { ok: false, detail: 'id or slug required' };
      const product = await prisma.product.findUnique({
        where: id ? { id } : { slug: slug as string },
      });
      if (!product) return { ok: false, detail: 'Product not found' };
      return { ok: true, detail: `Product ${product.name} fetched`, data: { product } };
    },
  },

  getInventory: {
    description: 'Read stock levels; optionally only low-stock products',
    execute: async (input) => {
      const onlyLowStock = Boolean(input.onlyLowStock);
      const threshold = clamp(num(input.threshold) ?? 5, 0, 1000);
      const limit = clamp(num(input.limit) ?? 50, 1, 100);
      const products = await prisma.product.findMany({
        where: onlyLowStock ? { stock: { lte: threshold } } : {},
        orderBy: { stock: 'asc' },
        take: limit,
        select: { id: true, name: true, stock: true, category: true, status: true, originalPrice: true, salePrice: true },
      });
      return { ok: true, detail: `Fetched ${products.length} inventory rows`, data: { products } };
    },
  },

  getCustomers: {
    description: 'Read customers with optional segment filter',
    execute: async (input) => {
      const segment = str(input.segment);
      const limit = clamp(num(input.limit) ?? 20, 1, 50);
      const customers = await prisma.customer.findMany({
        where: segment ? { customerType: segment } : {},
        orderBy: { lastOrderAt: 'desc' },
        take: limit,
        select: {
          id: true, name: true, phone: true, customerType: true,
          totalOrders: true, totalSpent: true, lastOrderAt: true,
        },
      });
      return { ok: true, detail: `Fetched ${customers.length} customers`, data: { customers } };
    },
  },

  getCustomer: {
    description: 'Read a single customer by id or phone',
    execute: async (input) => {
      const id = str(input.id);
      const phone = str(input.phone);
      if (!id && !phone) return { ok: false, detail: 'id or phone required' };
      const customer = await prisma.customer.findUnique({
        where: id ? { id } : { phone: phone as string },
      });
      if (!customer) return { ok: false, detail: 'Customer not found' };
      return { ok: true, detail: `Customer fetched`, data: { customer } };
    },
  },

  getAnalytics: {
    description: 'Read event funnel and traffic source distribution',
    execute: async (input) => {
      const sinceDays = clamp(num(input.sinceDays) ?? 7, 1, 90);
      const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
      const [eventCountsRaw, sessions] = await Promise.all([
        prisma.analyticsEvent.groupBy({ by: ['eventType'], where: { createdAt: { gte: since } }, _count: { id: true } }),
        prisma.visitorSession.findMany({
          where: { createdAt: { gte: since } },
          select: { referrer: true },
          take: 500,
        }),
      ]);
      const eventFunnel: Record<string, number> = {};
      eventCountsRaw.forEach((e) => { eventFunnel[e.eventType] = e._count.id; });
      const trafficSources: Record<string, number> = {};
      sessions.forEach((s) => {
        const src = s.referrer || 'Direct';
        trafficSources[src] = (trafficSources[src] || 0) + 1;
      });
      return {
        ok: true,
        detail: `Analytics for last ${sinceDays} days`,
        data: { eventFunnel, trafficSources, sessions: sessions.length },
      };
    },
  },

  getAbandonedCarts: {
    description: 'Read abandoned carts with optional status filter',
    execute: async (input) => {
      const status = str(input.status);
      const limit = clamp(num(input.limit) ?? 20, 1, 50);
      const carts = await prisma.abandonedCart.findMany({
        where: status ? { status } : {},
        orderBy: { lastActiveAt: 'desc' },
        take: limit,
        select: {
          id: true, cartToken: true, cartValue: true, status: true,
          recoveryStatus: true, contactCount: true, lastActiveAt: true, customerPhone: true,
        },
      });
      return { ok: true, detail: `Fetched ${carts.length} carts`, data: { carts } };
    },
  },

  createNotification: {
    description: 'Create an internal admin notification (optionally push for critical)',
    execute: async (input) => {
      const type = str(input.type) || 'GENERAL';
      const title = str(input.title);
      const message = str(input.message);
      if (!title || !message) return { ok: false, detail: 'title and message required' };
      const priority = str(input.priority);
      const link = str(input.link);
      const dedupeKey = str(input.dedupeKey);
      if (dedupeKey) {
        const existing = await prisma.adminNotification.findFirst({
          where: { metadata: { contains: dedupeKey } },
          select: { id: true },
        });
        if (existing) return { ok: true, detail: 'Notification already exists (deduped)', data: { notificationId: existing.id, deduped: true } };
      }
      const notification = await prisma.adminNotification.create({
        data: {
          type,
          title,
          message,
          link: link || null,
          metadata: JSON.stringify({ ...(dedupeKey ? { dedupeKey } : {}), ...(priority ? { priority } : {}) }),
        },
      });
      if (priority === 'CRITICAL') {
        try {
          await sendPushNotification({ title, body: message, url: link || '/admin/automations' });
        } catch {
          // push is best-effort only
        }
      }
      return { ok: true, detail: 'Notification created', data: { notificationId: notification.id } };
    },
  },

  createAutomationTask: {
    description: 'Create an internal automation task (idempotent by taskKey)',
    execute: async (input) => {
      const taskKey = str(input.taskKey);
      const type = str(input.type) || 'GENERAL';
      const title = str(input.title);
      if (!taskKey || !title) return { ok: false, detail: 'taskKey and title required' };

      const existing = await prisma.agentTask.findUnique({ where: { taskKey }, select: { id: true, status: true } });
      if (existing) {
        const terminal = ['COMPLETED', 'REJECTED', 'DISMISSED'].includes(existing.status);
        if (!terminal) {
          return { ok: true, detail: 'Open task already exists (deduped)', data: { taskId: existing.id, created: false } };
        }
      }

      const task = await prisma.agentTask.create({
        data: {
          taskKey,
          type,
          title,
          description: str(input.description) || null,
          priority: str(input.priority) || 'MEDIUM',
          status: input.requiresApproval === true ? 'PENDING_APPROVAL' : 'PENDING',
          requiresApproval: input.requiresApproval === true,
          payload: (input.payload as JsonInput) ?? null,
          relatedType: str(input.relatedType) || null,
          relatedId: str(input.relatedId) || null,
        },
      });
      return { ok: true, detail: 'Task created', data: { taskId: task.id, created: true } };
    },
  },

  updateAbandonedCartContact: {
    description: 'Mark an abandoned cart as contacted (increments contactCount)',
    execute: async (input) => {
      const cartToken = str(input.cartToken);
      if (!cartToken) return { ok: false, detail: 'cartToken required' };
      const cart = await prisma.abandonedCart.update({
        where: { cartToken },
        data: {
          recoveryStatus: 'CONTACTED',
          lastContactedAt: new Date(),
          contactCount: { increment: 1 },
        },
        select: { id: true, contactCount: true },
      });
      return { ok: true, detail: `Cart marked contacted (count: ${cart.contactCount})`, data: { cartId: cart.id, contactCount: cart.contactCount } };
    },
  },

  generateBusinessReport: {
    description: 'Generate and persist a real-data business report (DAILY/WEEKLY/MONTHLY)',
    execute: async (input) => {
      const type = str(input.type) || 'DAILY';
      const validTypes = ['DAILY', 'WEEKLY', 'MONTHLY'];
      const reportType = validTypes.includes(type) ? (type as 'DAILY' | 'WEEKLY' | 'MONTHLY') : 'DAILY';
      const report = await generateBusinessReport(reportType);
      return {
        ok: true,
        detail: `${reportType} report generated`,
        data: {
          totalOrders: report.totalOrders,
          totalRevenue: report.totalRevenue,
          conversionRate: report.conversionRate,
          topProducts: report.topProducts.slice(0, 5),
          lowStockCount: report.lowStockProducts.length,
        },
      };
    },
  },

  sendWhatsAppMessage: {
    description: 'Send a WhatsApp message to a customer phone number',
    execute: async (input) => {
      const to = str(input.to);
      const message = str(input.message);
      if (!to || !message) return { ok: false, detail: 'to and message required' };
      if (message.length > 1500) return { ok: false, detail: 'message too long (max 1500 chars)' };
      await sendWhatsAppMessage(to, message);
      return { ok: true, detail: 'WhatsApp dispatch attempted (credentials gated)' };
    },
  },

  updateOrderStatus: {
    description: 'Change an order status (high impact — approval required)',
    execute: async (input) => {
      const id = str(input.id);
      const status = str(input.status);
      if (!id || !status) return { ok: false, detail: 'id and status required' };
      if (!VALID_ORDER_STATUSES.includes(status)) return { ok: false, detail: 'Invalid status' };

      const result = await prisma.$transaction(async (tx) => {
        const currentOrder = await tx.order.findUnique({ where: { id }, select: { id: true, orderId: true, status: true } });
        if (!currentOrder) throw new Error('Order not found');

        if (status === 'CANCELLED' && currentOrder.status !== 'CANCELLED') {
          const { restoreOrderStock } = await import('@/lib/inventory');
          await restoreOrderStock(tx, id);
        }

        const updated = await tx.order.update({ where: { id }, data: { status } });
        await tx.adminNotification.create({
          data: {
            type: status === 'CANCELLED' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED',
            title: `Order Status: ${status} (AI Agent)`,
            message: `Order #${updated.orderId} was set to ${status} by the AI automation agent (approved action).`,
            link: `/admin/orders/${updated.id}`,
            metadata: JSON.stringify({ orderId: updated.id, status, actor: 'ai-agent' }),
          },
        });
        return updated;
      });

      return { ok: true, detail: `Order ${result.orderId} updated to ${status}`, data: { orderId: result.orderId, status } };
    },
  },
};

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx: ToolContext = { actor: 'ai-agent' }
): Promise<ToolResult> {
  const tool = tools[toolName];
  if (!tool) {
    return { ok: false, detail: `Unknown tool: ${toolName} — blocked` };
  }
  try {
    return await tool.execute(input, ctx);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, detail: `Tool ${toolName} failed: ${message}`, error: message } as ToolResult & { error: string };
  }
}

export function listTools(): Array<{ name: string; description: string }> {
  return Object.entries(tools).map(([name, t]) => ({ name, description: t.description }));
}
