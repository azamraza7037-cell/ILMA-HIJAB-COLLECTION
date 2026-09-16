// @ts-nocheck
import prisma from '@/lib/prisma';
import { prompts } from './prompts';
import { model } from './model';
import type { BusinessSnapshot, AnalysisFinding, PlannedAction, AgentSettings } from './types';

function weekKey(d = new Date()): string {
  const start = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - start.getTime()) / 86400000 + start.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${week}`;
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function hasOpenTask(taskKey: string): Promise<boolean> {
  return prisma.agentTask
    .findUnique({ where: { taskKey }, select: { status: true } })
    .then((t) => Boolean(t && !['COMPLETED', 'REJECTED', 'DISMISSED'].includes(t.status)))
    .catch(() => false);
}

async function isCustomerOnCooldown(phone: string, cooldownHours: number): Promise<boolean> {
  const cart = await prisma.abandonedCart.findFirst({
    where: { customerPhone: { contains: phone.slice(-10) } },
    orderBy: { lastContactedAt: 'desc' },
    select: { lastContactedAt: true },
  });
  if (!cart?.lastContactedAt) return false;
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  return Date.now() - new Date(cart.lastContactedAt).getTime() < cooldownMs;
}

async function generateMessage(
  system: string,
  prompt: string,
  fallback: string
): Promise<string> {
  try {
    const res = await model.generate({
      system,
      messages: [{ role: 'user', content: prompt }],
      json: true,
      maxTokens: 300,
      temperature: 0.4,
      timeoutMs: 20000,
    });
    if (res.ok) {
      const parsed = JSON.parse(res.text) as { message?: string };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim().slice(0, 900);
      }
    }
  } catch {
    // fall through to deterministic template
  }
  return fallback;
}

export async function planActions(
  trigger: string,
  snapshot: BusinessSnapshot,
  findings: AnalysisFinding[],
  settings: AgentSettings
): Promise<PlannedAction[]> {
  const actions: PlannedAction[] = [];

  const inventoryFindings = findings.filter(
    (f) => ['LOW_STOCK', 'OUT_OF_STOCK', 'RESTOCK_RECOMMENDED', 'FAST_SELLING'].includes(f.kind)
  );
  if (inventoryFindings.length > 0 && (trigger === 'SCHEDULED_SWEEP' || trigger === 'MANUAL_ADMIN_TRIGGER')) {
    const critical: Array<{ id: string; name: string; stock: number }> = [
      ...snapshot.outOfStock.map((p) => ({ ...p, stock: 0 })),
      ...snapshot.lowStock,
    ].slice(0, 5);
    for (const p of critical) {
      const key = p.stock === 0 ? `oos:${p.id}:${dayKey()}` : `restock-rec:${p.id}:${weekKey()}`;
      actions.push({
        tool: 'createAutomationTask',
        level: 1,
        reason: p.stock === 0 ? 'Product is out of stock — restock needed urgently' : 'Low stock / fast seller — restock recommendation',
        input: {
          taskKey: key,
          type: p.stock === 0 ? 'OUT_OF_STOCK' : 'RESTOCK_RECOMMENDATION',
          title: p.stock === 0 ? `URGENT: "${p.name}" is OUT OF STOCK` : `Restock recommendation: "${p.name}" (${p.stock} left)`,
          description:
            p.stock === 0
              ? `"${p.name}" has 0 units in stock. Every hour out of stock loses potential sales. Restock as soon as possible.`
              : `"${p.name}" has only ${p.stock} units left. Based on recent sales velocity, consider restocking up to 2x weekly sales plus buffer.`,
          priority: p.stock === 0 ? 'CRITICAL' : 'HIGH',
          requiresApproval: false,
          relatedType: 'product',
          relatedId: p.id,
          payload: { reason: p.stock === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK', productId: p.id, currentStock: p.stock },
        },
      });
    }

    actions.push({
      tool: 'createNotification',
      level: 1,
      reason: 'Inventory alerts deserve admin visibility',
      input: {
        type: 'LOW_STOCK',
        title: snapshot.outOfStock.length > 0 ? '🚨 Inventory: out-of-stock items' : '⚠️ Inventory: low stock items',
        message:
          snapshot.outOfStock.length > 0
            ? `Out of stock: ${snapshot.outOfStock.map((p) => p.name).join(', ')}. ${snapshot.lowStock.length} more product(s) running low.`
            : `Low stock: ${snapshot.lowStock.slice(0, 4).map((p) => `${p.name} (${p.stock})`).join(', ')}${snapshot.lowStock.length > 4 ? ` +${snapshot.lowStock.length - 4} more` : ''}.`,
        link: '/admin/products',
        priority: snapshot.outOfStock.length > 0 ? 'CRITICAL' : undefined,
        dedupeKey: `inventory-alert:${dayKey()}`,
      },
    });
  }

  const cartFindings = findings.filter((f) => f.kind === 'CART_ABANDONED');
  for (const f of cartFindings.slice(0, 5)) {
    const cart = snapshot.abandonedCarts.pendingRecovery.find((c) => c.cartToken === f.cartToken);
    if (!cart || !cart.hasPhone) continue;

    const taskKey = `cart-recovery:${cart.cartToken}`;
    if (await hasOpenTask(taskKey)) continue;

    const phone = await prisma.abandonedCart.findUnique({
      where: { cartToken: cart.cartToken },
      select: { customerPhone: true },
    });
    if (!phone?.customerPhone) continue;
    if (await isCustomerOnCooldown(phone.customerPhone, settings.customerCooldownHours)) continue;

    const fallbackMessage = `Assalamu Alaikum 🌙\n\nYour Ilma Hijab Collection cart with ${cart.itemCount} item(s) (${cart.itemNames.join(', ')}) worth ₹${cart.cartValue.toLocaleString('en-IN')} is still saved for you.\n\nComplete your order anytime — we are happy to help with sizing or questions on WhatsApp.\n\n— Ilma Hijab Collection`;
    const message = await generateMessage(
      prompts.customerMessageSystem,
      prompts.buildRecoveryMessagePrompt({
        cartValue: cart.cartValue,
        itemCount: cart.itemCount,
        itemNames: cart.itemNames,
        ageMinutes: cart.ageMinutes,
      }),
      fallbackMessage
    );

    actions.push({
      tool: 'sendWhatsAppMessage',
      level: 2,
      reason: `Personalized cart recovery draft for abandoned cart (INR ${cart.cartValue})`,
      input: { to: phone.customerPhone, message },
      followUps: [{ tool: 'updateAbandonedCartContact', input: { cartToken: cart.cartToken } }],
    });
  }

  if (
    snapshot.pendingOrders.count > 0 &&
    (snapshot.pendingOrders.oldestHours ?? 0) >= settings.pendingOrderThresholdHours &&
    (trigger === 'SCHEDULED_SWEEP' || trigger === 'MANUAL_ADMIN_TRIGGER')
  ) {
    const staleOrders = await prisma.order.findMany({
      where: {
        status: 'PENDING',
        createdAt: { lte: new Date(Date.now() - settings.pendingOrderThresholdHours * 3600000) },
      },
      select: { id: true, orderId: true, customerName: true, totalAmount: true, createdAt: true },
      take: 5,
      orderBy: { createdAt: 'asc' },
    });
    for (const o of staleOrders) {
      actions.push({
        tool: 'createAutomationTask',
        level: 1,
        reason: `Order ${o.orderId} pending for over ${settings.pendingOrderThresholdHours} hours`,
        input: {
          taskKey: `pending-order:${o.id}:${dayKey()}`,
          type: 'PENDING_ORDER',
          title: `Order ${o.orderId} pending ${Math.round((Date.now() - new Date(o.createdAt).getTime()) / 3600000)}h — needs confirmation`,
          description: `Order #${o.orderId} from ${o.customerName} (₹${o.totalAmount.toLocaleString('en-IN')}) is still PENDING. Confirm payment/intent and move it forward.`,
          priority: 'HIGH',
          relatedType: 'order',
          relatedId: o.id,
        },
      });
    }
  }

  if (snapshot.failedPayments.count > 0 && (trigger === 'SCHEDULED_SWEEP' || trigger === 'MANUAL_ADMIN_TRIGGER')) {
    const failedOrders = await prisma.order.findMany({
      where: { paymentStatus: 'FAILED' },
      select: { id: true, orderId: true, customerName: true, totalAmount: true },
      take: 5,
      orderBy: { updatedAt: 'desc' },
    });
    for (const o of failedOrders) {
      actions.push({
        tool: 'createAutomationTask',
        level: 1,
        reason: `Failed payment on order ${o.orderId}`,
        input: {
          taskKey: `failed-payment:${o.id}`,
          type: 'FAILED_PAYMENT',
          title: `Failed payment: order ${o.orderId} (₹${o.totalAmount.toLocaleString('en-IN')})`,
          description: `Payment failed for order #${o.orderId} from ${o.customerName}. Reach out to offer an alternative payment method (COD/UPI).`,
          priority: 'CRITICAL',
          relatedType: 'order',
          relatedId: o.id,
        },
      });
    }
  }

  if (trigger === 'DAILY_SUMMARY') {
    actions.push({
      tool: 'generateBusinessReport',
      level: 1,
      reason: 'Daily executive report keeps records for trend analysis',
      input: { type: 'DAILY' },
    });
    actions.push({
      tool: 'createNotification',
      level: 1,
      reason: 'Admin should see the daily AI summary',
      input: {
        type: 'DAILY_SUMMARY',
        title: '📊 Daily AI Business Summary ready',
        message: snapshot.today.orders > 0
          ? `Today: ${snapshot.today.orders} order(s), INR ${snapshot.today.revenue.toLocaleString('en-IN')} revenue, ${snapshot.today.visitors} visitor(s), conversion ${snapshot.today.conversionRate}%. ${snapshot.lowStock.length + snapshot.outOfStock.length} inventory alert(s). Full analysis in Automations.`
          : `No orders today yet. ${snapshot.today.visitors} visitor(s) so far. ${snapshot.lowStock.length + snapshot.outOfStock.length} inventory alert(s). Full analysis in Automations.`,
        link: '/admin/automations',
        dedupeKey: `daily-summary:${dayKey()}`,
      },
    });
  }

  if (trigger === 'ORDER_CREATED') {
    const orderId = findings.find((f) => f.orderId)?.orderId;
    if (orderId) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderId: true, paymentMethod: true, paymentStatus: true, totalAmount: true, customerName: true },
      });
      if (order && order.paymentMethod === 'COD' && order.paymentStatus === 'COD') {
        actions.push({
          tool: 'createAutomationTask',
          level: 1,
          reason: 'COD order requires payment collection on delivery',
          input: {
            taskKey: `cod-fulfillment:${order.id}`,
            type: 'FULFILLMENT',
            title: `COD order ${order.orderId} — collect ₹${order.totalAmount.toLocaleString('en-IN')} on delivery`,
            description: `Cash-on-delivery order #${order.orderId} from ${order.customerName}. Remember to collect the COD payment and mark the order DELIVERED.`,
            priority: order.totalAmount >= 2500 ? 'HIGH' : 'MEDIUM',
            relatedType: 'order',
            relatedId: order.id,
          },
        });
      }
    }
  }

  if (trigger === 'ORDER_STATUS_CHANGED') {
    const orderId = findings.find((f) => f.orderId)?.orderId;
    const newStatus = findings.find((f) => f.orderId)?.data?.['newStatus'] as string | undefined;
    if (orderId && newStatus && ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(newStatus)) {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, orderId: true, customerWhatsapp: true, customerPhone: true, customerName: true, status: true },
      });
      const phone = order?.customerWhatsapp || order?.customerPhone;
      if (order && phone) {
        const taskKey = `status-msg:${order.id}:${newStatus}`;
        if (!(await hasOpenTask(taskKey)) && !(await isCustomerOnCooldown(phone, settings.customerCooldownHours))) {
          const fallbackMessage = `Assalamu Alaikum 🌙\n\nUpdate on your Ilma Hijab Collection order ${order.orderId}: status is now ${newStatus.toLowerCase().replace(/_/g, ' ')}.\n\n${newStatus === 'DELIVERED' ? 'JazakAllahu Khairan for shopping with us — we would love your feedback!' : 'Thank you for your patience.'}\n\n— Ilma Hijab Collection`;
          const message = await generateMessage(
            prompts.customerMessageSystem,
            prompts.buildStatusMessagePrompt({ orderId: order.orderId, status: newStatus, customerName: order.customerName || 'Customer' }),
            fallbackMessage
          );
          actions.push({
            tool: 'sendWhatsAppMessage',
            level: 2,
            reason: `Customer status update draft for order ${order.orderId} (${newStatus})`,
            input: { to: phone, message },
          });
        }
      }
    }
  }

  return actions;
}
