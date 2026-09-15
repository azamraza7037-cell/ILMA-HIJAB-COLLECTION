import { executeTool } from './tools';
import { evaluateActionPolicy } from './policies';
import prisma from '@/lib/prisma';
import type { PlannedAction, ExecutionActionRecord, AgentSettings, JsonInput } from './types';

export interface ExecutionOutcome {
  executed: ExecutionActionRecord[];
  deferred: ExecutionActionRecord[];
}

/**
 * Execute planned actions honoring the safety policy:
 * - Level 0/1: execute immediately.
 * - Level 2: execute only if admin enabled auto-send (cooldown was checked by the
 *   planner); otherwise defer into an approval task.
 * - Level 3: always defer into an approval task.
 */
export async function executeActions(
  plan: PlannedAction[],
  settings: AgentSettings,
  executionId: string
): Promise<ExecutionOutcome> {
  const executed: ExecutionActionRecord[] = [];
  const deferred: ExecutionActionRecord[] = [];

  for (const action of plan) {
    const policy = evaluateActionPolicy({ tool: action.tool, settings });

    if (policy.autoExecute) {
      const result = await executeTool(action.tool, action.input);
      if (result.ok) {
        executed.push({ tool: action.tool, status: 'EXECUTED', detail: result.detail, taskId: extractTaskId(result.data) });

        if (action.followUps && action.followUps.length > 0) {
          for (const followUp of action.followUps) {
            const fuResult = await executeTool(followUp.tool, followUp.input);
            executed.push({
              tool: followUp.tool,
              status: fuResult.ok ? 'EXECUTED' : 'FAILED',
              detail: fuResult.detail,
              error: fuResult.ok ? undefined : fuResult.detail,
            });
          }
        }
      } else {
        executed.push({ tool: action.tool, status: 'FAILED', detail: result.detail, error: result.detail });
      }
    } else {
      const taskId = await deferForApproval(action, executionId, policy.reason);
      deferred.push({ tool: action.tool, status: 'DEFERRED', detail: policy.reason, taskId: taskId ?? undefined });
    }
  }

  return { executed, deferred };
}

function extractTaskId(data: unknown): string | undefined {
  if (data && typeof data === 'object' && 'taskId' in data) {
    const value = (data as Record<string, unknown>).taskId;
    return typeof value === 'string' ? value : undefined;
  }
  return undefined;
}

async function deferForApproval(
  action: PlannedAction,
  executionId: string,
  reason: string
): Promise<string | null> {
  try {
    const input = action.input as Record<string, unknown>;
    const to = typeof input.to === 'string' ? input.to : '';
    const message = typeof input.message === 'string' ? input.message : '';
    const dedupeBase = to ? to.slice(-10) : 'action';
    const taskKey = `approval:${action.tool}:${dedupeBase}:${message.slice(0, 40).replace(/\s+/g, '-')}`;

    const existing = await prisma.agentTask.findUnique({ where: { taskKey }, select: { id: true, status: true } });
    if (existing && !['REJECTED', 'COMPLETED', 'DISMISSED'].includes(existing.status)) {
      return existing.id;
    }

    const cartToken = typeof input.cartToken === 'string' ? input.cartToken : undefined;
    const relatedType = cartToken ? 'cart' : undefined;
    const relatedId = cartToken
      ? (await prisma.abandonedCart.findUnique({ where: { cartToken }, select: { id: true } }))?.id
      : undefined;

    const payloadObj: Record<string, unknown> = {
      actions: [{ tool: action.tool, input: action.input }, ...(action.followUps || [])],
      reason,
    };
    if (message) payloadObj.preparedMessage = message;

    const task = await prisma.agentTask.create({
      data: {
        taskKey,
        type: action.tool === 'sendWhatsAppMessage' ? 'CART_RECOVERY' : 'APPROVAL',
        title:
          action.tool === 'sendWhatsAppMessage'
            ? `Customer message awaiting approval (${to.slice(-4).padStart(6, '•')})`
            : `Action awaiting approval: ${action.tool}`,
        description: action.reason,
        priority: 'HIGH',
        status: 'PENDING_APPROVAL',
        requiresApproval: true,
        payload: payloadObj as unknown as JsonInput,
        relatedType,
        relatedId,
        executionId,
      },
    });
    return task.id;
  } catch {
    return null;
  }
}
