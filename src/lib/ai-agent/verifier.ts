import prisma from '@/lib/prisma';
import type { ExecutionActionRecord, PlannedAction, VerificationResult, VerificationCheck } from './types';

/**
 * Post-execution verification: confirm expected side effects actually exist in
 * the database. Read-only. Failures here do not roll back work — they are
 * surfaced in the execution record for admin review.
 */
export async function verifyExecution(
  plan: PlannedAction[],
  executed: ExecutionActionRecord[],
  deferred: ExecutionActionRecord[]
): Promise<VerificationResult> {
  const checks: VerificationCheck[] = [];

  const taskActions = plan.filter((a) => a.tool === 'createAutomationTask' && a.input['taskKey']);
  for (const action of taskActions.slice(0, 10)) {
    const taskKey = String(action.input['taskKey']);
    try {
      const task = await prisma.agentTask.findUnique({ where: { taskKey }, select: { id: true, status: true } });
      checks.push({
        check: `task:${taskKey}`,
        passed: Boolean(task),
        detail: task ? `status=${task.status}` : 'task not found after execution',
      });
    } catch (e) {
      checks.push({ check: `task:${taskKey}`, passed: false, detail: e instanceof Error ? e.message : 'query failed' });
    }
  }

  const dedupedNotifications = plan.filter((a) => a.tool === 'createNotification' && a.input['dedupeKey']);
  for (const action of dedupedNotifications.slice(0, 10)) {
    const dedupeKey = String(action.input['dedupeKey']);
    try {
      const notification = await prisma.adminNotification.findFirst({
        where: { metadata: { contains: dedupeKey } },
        select: { id: true },
      });
      checks.push({
        check: `notification:${dedupeKey}`,
        passed: Boolean(notification),
        detail: notification ? 'exists' : 'not found (may be deduped by an earlier identical notification)',
      });
    } catch (e) {
      checks.push({ check: `notification:${dedupeKey}`, passed: false, detail: e instanceof Error ? e.message : 'query failed' });
    }
  }

  const approvalTaskIds = deferred.map((d) => d.taskId).filter((id): id is string => Boolean(id));
  for (const taskId of approvalTaskIds.slice(0, 10)) {
    try {
      const task = await prisma.agentTask.findUnique({ where: { id: taskId }, select: { status: true } });
      checks.push({
        check: `approval-task:${taskId}`,
        passed: task?.status === 'PENDING_APPROVAL',
        detail: task ? `status=${task.status}` : 'approval task not found',
      });
    } catch (e) {
      checks.push({ check: `approval-task:${taskId}`, passed: false, detail: e instanceof Error ? e.message : 'query failed' });
    }
  }

  if (checks.length === 0) {
    checks.push({
      check: 'no-verifiable-side-effects',
      passed: true,
      detail: executed.length === 0 && deferred.length === 0 ? 'No actions were planned or executed' : 'Only non-persistent actions ran',
    });
  }

  return { verified: checks.every((c) => c.passed), checks };
}
