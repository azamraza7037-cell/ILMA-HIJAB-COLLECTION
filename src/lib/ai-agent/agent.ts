import prisma from '@/lib/prisma';
import { buildBusinessSnapshot } from './context';
import { analyze } from './reasoning';
import { planActions } from './planner';
import { executeActions } from './executor';
import { verifyExecution } from './verifier';
import { getAgentSettings, saveAgentSettings, saveMemoryFact } from './memory';
import { DEFAULT_SETTINGS } from './policies';
import type {
  AgentTrigger,
  AgentRunResult,
  AnalysisFinding,
  BusinessSnapshot,
  JsonInput,
} from './types';

const STALE_RUN_MINUTES = 10;

const DEFAULT_RULES: Array<{
  key: string;
  name: string;
  description: string;
  trigger: AgentTrigger;
  config: JsonInput;
}> = [
  {
    key: 'order_lifecycle_automation',
    name: 'Order Lifecycle Automation',
    description: 'Validates new orders, flags COD fulfillment, and audits every order event.',
    trigger: 'ORDER_CREATED',
    config: { highValueThreshold: 2500 },
  },
  {
    key: 'order_status_communication',
    name: 'Order Status Communication',
    description: 'Prepares customer status-update messages for shipped/out-for-delivery/delivered orders (approval gated).',
    trigger: 'ORDER_STATUS_CHANGED',
    config: { statuses: ['SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'] },
  },
  {
    key: 'scheduled_sweep',
    name: 'Scheduled Business Sweep',
    description: 'Hourly sweep: low/out-of-stock, fast sellers, stale pending orders, failed payments, abandoned carts.',
    trigger: 'SCHEDULED_SWEEP',
    config: { intervalMinutes: 60 },
  },
  {
    key: 'daily_summary',
    name: 'Daily AI Business Summary',
    description: 'Generates the daily executive report, insight notification, and memory facts.',
    trigger: 'DAILY_SUMMARY',
    config: { scheduleHourUtc: 20 },
  },
];

async function ensureDefaultRules(): Promise<void> {
  for (const rule of DEFAULT_RULES) {
    await prisma.automationRule.upsert({
      where: { key: rule.key },
      update: {},
      create: {
        key: rule.key,
        name: rule.name,
        description: rule.description,
        trigger: rule.trigger,
        enabled: true,
        config: rule.config as unknown as JsonInput,
      },
    });
  }
}

function hourKey(d = new Date()): string {
  return `${d.toISOString().slice(0, 13)}h`;
}

function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function setAgentEnabled(enabled: boolean): Promise<void> {
  await saveAgentSettings({ agentEnabled: enabled });
}

export async function isAgentEnabled(): Promise<boolean> {
  return (await getAgentSettings()).agentEnabled;
}

/**
 * Idempotency gate. Returns a RunResult with status SKIPPED when this exact
 * execution key already ran successfully, or is currently running.
 */
async function checkIdempotency(
  executionKey: string,
  force: boolean
): Promise<{ skip: boolean; existingId?: string; reason?: string }> {
  const existing = await prisma.agentExecution.findUnique({
    where: { executionKey },
    select: { id: true, status: true, createdAt: true },
  });
  if (!existing) return { skip: false };

  if (force) return { skip: false };

  if (existing.status === 'SUCCEEDED') {
    return { skip: true, existingId: existing.id, reason: 'This execution key already ran successfully (idempotent skip)' };
  }
  if (existing.status === 'RUNNING') {
    const ageMinutes = (Date.now() - new Date(existing.createdAt).getTime()) / 60000;
    if (ageMinutes < STALE_RUN_MINUTES) {
      return { skip: true, existingId: existing.id, reason: 'A run with this key is already in progress (lock held)' };
    }
    // stale run: allow a fresh run under a suffixed key
  }
  return { skip: false };
}

async function buildFindings(
  trigger: AgentTrigger,
  snapshot: BusinessSnapshot,
  eventContext?: Record<string, unknown>
): Promise<AnalysisFinding[]> {
  const findings: AnalysisFinding[] = [];

  for (const p of snapshot.outOfStock) {
    findings.push({ kind: 'OUT_OF_STOCK', severity: 'CRITICAL', productId: p.id, message: `"${p.name}" is out of stock (0 units).`, data: { productId: p.id } });
  }
  for (const p of snapshot.lowStock) {
    findings.push({ kind: 'LOW_STOCK', severity: 'HIGH', productId: p.id, message: `"${p.name}" is low on stock (${p.stock} units left).`, data: { productId: p.id } });
  }
  for (const p of snapshot.fastSelling) {
    findings.push({ kind: 'FAST_SELLING', severity: 'MEDIUM', productId: p.id, message: `"${p.name}" sold ${p.sold14d} units in 14 days with only ${p.stock} in stock.`, data: { productId: p.id } });
  }
  for (const c of snapshot.abandonedCarts.pendingRecovery) {
    findings.push({
      kind: 'CART_ABANDONED',
      severity: 'MEDIUM',
      cartToken: c.cartToken,
      message: `Abandoned cart worth INR ${c.cartValue} idle for ${c.ageMinutes} minutes (${c.itemCount} items).`,
      data: { cartToken: c.cartToken },
    });
  }
  if (snapshot.pendingOrders.count > 0) {
    findings.push({
      kind: 'PENDING_ORDER_STALE',
      severity: (snapshot.pendingOrders.oldestHours ?? 0) >= 24 ? 'HIGH' : 'MEDIUM',
      message: `${snapshot.pendingOrders.count} order(s) still PENDING (oldest ${snapshot.pendingOrders.oldestHours ?? '?'} hours).`,
    });
  }
  if (snapshot.failedPayments.count > 0) {
    findings.push({ kind: 'FAILED_PAYMENT', severity: 'CRITICAL', message: `${snapshot.failedPayments.count} failed payment(s) need follow-up.` });
  }
  if (snapshot.customers.atRisk > 0) {
    findings.push({ kind: 'CUSTOMER_AT_RISK', severity: 'MEDIUM', message: `${snapshot.customers.atRisk} previously loyal customer(s) inactive for 45+ days.` });
  }
  if (snapshot.today.visitors > 10 && snapshot.today.conversionRate < 2) {
    findings.push({ kind: 'CONVERSION_LOW', severity: 'MEDIUM', message: `Conversion is ${snapshot.today.conversionRate}% with ${snapshot.today.visitors} visitors today.` });
  }

  if (trigger === 'ORDER_CREATED' && eventContext?.orderId) {
    findings.push({
      kind: 'INFO',
      severity: 'INFO',
      orderId: String(eventContext.orderId),
      message: `Order event received: ${String(eventContext.orderId)}`,
      data: { orderId: String(eventContext.orderId) },
    });
  }
  if (trigger === 'ORDER_STATUS_CHANGED' && eventContext?.orderId && eventContext?.newStatus) {
    findings.push({
      kind: 'INFO',
      severity: 'INFO',
      orderId: String(eventContext.orderId),
      message: `Order ${String(eventContext.orderId)} changed status to ${String(eventContext.newStatus)}.`,
      data: { orderId: String(eventContext.orderId), newStatus: String(eventContext.newStatus) },
    });
  }

  return findings;
}

export async function runAgent(opts: {
  trigger: AgentTrigger;
  executionKey?: string;
  eventContext?: Record<string, unknown>;
  force?: boolean;
}): Promise<AgentRunResult> {
  const startedAt = Date.now();
  const executionKey = opts.executionKey || `${opts.trigger.toLowerCase()}:${dayKey()}:${hourKey()}`;
  const executionId = crypto.randomUUID();

  try {
    await ensureDefaultRules();

    const settings = await getAgentSettings();
    if (!settings.agentEnabled) {
      return {
        executionId,
        executionKey,
        trigger: opts.trigger,
        status: 'SKIPPED',
        skippedReason: 'Agent is disabled by admin',
        actionsPlanned: 0,
        actionsExecuted: [],
        actionsDeferred: [],
        durationMs: Date.now() - startedAt,
      };
    }

    const idempotency = await checkIdempotency(executionKey, Boolean(opts.force));
    if (idempotency.skip) {
      return {
        executionId: idempotency.existingId || executionId,
        executionKey,
        trigger: opts.trigger,
        status: 'SKIPPED',
        skippedReason: idempotency.reason,
        actionsPlanned: 0,
        actionsExecuted: [],
        actionsDeferred: [],
        durationMs: Date.now() - startedAt,
      };
    }

    await prisma.agentExecution.create({
      data: {
        id: executionId,
        executionKey,
        trigger: opts.trigger,
        status: 'RUNNING',
        context: opts.eventContext ? (opts.eventContext as unknown as JsonInput) : undefined,
      },
    });

    const snapshot = await buildBusinessSnapshot({
      lowStockThreshold: settings.lowStockThreshold,
      fastSellingStockMultiplier: settings.fastSellingStockMultiplier,
      abandonedCartIdleMinutes: settings.abandonedCartIdleMinutes,
      pendingOrderThresholdHours: settings.pendingOrderThresholdHours,
    });

    const findings = await buildFindings(opts.trigger, snapshot, opts.eventContext);
    const reasoning = await analyze(opts.trigger, snapshot, findings);
    const plan = await planActions(opts.trigger, snapshot, findings, settings);

    const { executed, deferred } = await executeActions(plan, settings, executionId);
    const verification = await verifyExecution(plan, executed, deferred);

    const failedActions = executed.filter((a) => a.status === 'FAILED');
    const status = failedActions.length > 0 && executed.every((a) => a.status === 'FAILED') ? 'FAILED' : 'SUCCEEDED';
    const finishedAt = new Date();
    const durationMs = Date.now() - startedAt;

    await prisma.agentExecution.update({
      where: { id: executionId },
      data: {
        status,
        plan: plan as unknown as JsonInput,
        result: { executed, deferred } as unknown as JsonInput,
        reasoning: reasoning.summary,
        model: reasoning.provider,
        verified: verification.verified,
        durationMs,
        finishedAt,
        ...(status === 'FAILED' ? { error: failedActions.map((a) => `${a.tool}: ${a.error || a.detail}`).join('; ').slice(0, 2000) } : {}),
      },
    });

    await saveMemoryFact({
      key: `run:${executionKey}`,
      category: 'DECISION',
      value: `${status} | ${opts.trigger} | planned ${plan.length}, executed ${executed.length}, deferred ${deferred.length} | ${reasoning.summary}`.slice(0, 1500),
      metadata: { trigger: opts.trigger, status, executionId },
    });

    if (status === 'SUCCEEDED' && (opts.trigger === 'DAILY_SUMMARY' || opts.trigger === 'SCHEDULED_SWEEP')) {
      await saveMemoryFact({
        key: `snapshot:${dayKey()}`,
        category: 'FACT',
        value: `Orders today ${snapshot.today.orders}, revenue INR ${snapshot.today.revenue}, visitors ${snapshot.today.visitors}, low stock ${snapshot.lowStock.length}, out of stock ${snapshot.outOfStock.length}, abandoned carts pending recovery ${snapshot.abandonedCarts.pendingRecovery.length}, pending orders ${snapshot.pendingOrders.count}, failed payments ${snapshot.failedPayments.count}, at-risk customers ${snapshot.customers.atRisk}`,
        metadata: { date: dayKey() },
      });
    }

    return {
      executionId,
      executionKey,
      trigger: opts.trigger,
      status,
      findings,
      reasoning: reasoning.summary,
      model: reasoning.provider,
      actionsPlanned: plan.length,
      actionsExecuted: executed,
      actionsDeferred: deferred,
      verification,
      durationMs,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const durationMs = Date.now() - startedAt;
    try {
      await prisma.agentExecution.upsert({
        where: { id: executionId },
        update: { status: 'FAILED', error: message.slice(0, 2000), finishedAt: new Date(), durationMs },
        create: {
          id: executionId,
          executionKey: `${executionKey}:err:${Date.now()}`,
          trigger: opts.trigger,
          status: 'FAILED',
          error: message.slice(0, 2000),
          durationMs,
          finishedAt: new Date(),
        },
      });
    } catch {
      // persistence of the failure itself failed — surface in result
    }
    return {
      executionId,
      executionKey,
      trigger: opts.trigger,
      status: 'FAILED',
      actionsPlanned: 0,
      actionsExecuted: [],
      actionsDeferred: [],
      error: message,
      durationMs,
    };
  }
}

/**
 * Event collector entry point used by business flows (order creation, status
 * changes). Fire-safe: never throws, never blocks business flow on failure.
 */
export async function recordAgentEvent(input: {
  trigger: AgentTrigger;
  executionKey: string;
  eventContext?: Record<string, unknown>;
}): Promise<AgentRunResult> {
  try {
    return await runAgent(input);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      executionId: 'n/a',
      executionKey: input.executionKey,
      trigger: input.trigger,
      status: 'FAILED',
      actionsPlanned: 0,
      actionsExecuted: [],
      actionsDeferred: [],
      error: message,
      durationMs: 0,
    };
  }
}

export async function retryExecution(executionId: string): Promise<AgentRunResult | null> {
  const execution = await prisma.agentExecution.findUnique({
    where: { id: executionId },
    select: { trigger: true, executionKey: true, context: true },
  });
  if (!execution) return null;
  return runAgent({
    trigger: execution.trigger as AgentTrigger,
    executionKey: `${execution.executionKey}:retry-${Date.now()}`,
    eventContext: (execution.context as Record<string, unknown> | null) ?? undefined,
    force: true,
  });
}

export { DEFAULT_SETTINGS };
