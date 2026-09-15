import { model } from './model';
import { prompts } from './prompts';
import { summarizeSnapshot } from './context';
import { getRecentMemoryForContext } from './memory';
import type { BusinessSnapshot, AnalysisFinding, ReasoningOutput } from './types';

function deterministicReasoning(
  trigger: string,
  snapshot: BusinessSnapshot,
  findings: AnalysisFinding[]
): ReasoningOutput {
  const recommendations: string[] = [];
  const risks: string[] = [];

  if (snapshot.outOfStock.length > 0) {
    recommendations.push(
      `Restock immediately: ${snapshot.outOfStock.map((p) => `"${p.name}"`).join(', ')} ${snapshot.outOfStock.length === 1 ? 'is' : 'are'} out of stock and losing sales.`
    );
    risks.push(`${snapshot.outOfStock.length} product(s) at zero stock.`);
  }
  if (snapshot.lowStock.length > 0) {
    recommendations.push(
      `Restock soon: ${snapshot.lowStock.slice(0, 3).map((p) => `"${p.name}" (${p.stock} left)`).join(', ')} ${snapshot.lowStock.length > 3 ? `and ${snapshot.lowStock.length - 3} more` : ''} running low.`
    );
  }
  if (snapshot.fastSelling.length > 0) {
    recommendations.push(
      `Fast movers need deeper stock: ${snapshot.fastSelling.slice(0, 3).map((p) => `"${p.name}" (${p.sold14d} sold in 14 days, only ${p.stock} left)`).join(', ')}.`
    );
  }
  if (snapshot.abandonedCarts.pendingRecovery.length > 0) {
    recommendations.push(
      `${snapshot.abandonedCarts.pendingRecovery.length} abandoned cart(s) worth a follow-up (total value INR ${snapshot.abandonedCarts.pendingRecovery.reduce((s, c) => s + c.cartValue, 0)}).`
    );
    risks.push(`INR ${snapshot.abandonedCarts.pendingRecovery.reduce((s, c) => s + c.cartValue, 0)} tied up in abandoned carts.`);
  }
  if (snapshot.pendingOrders.count > 0) {
    recommendations.push(
      `${snapshot.pendingOrders.count} order(s) still PENDING (oldest ${snapshot.pendingOrders.oldestHours ?? '?'} hours) — confirm and process them.`
    );
    if ((snapshot.pendingOrders.oldestHours ?? 0) >= 24) {
      risks.push(`Oldest pending order is ${snapshot.pendingOrders.oldestHours} hours old.`);
    }
  }
  if (snapshot.failedPayments.count > 0) {
    recommendations.push(`${snapshot.failedPayments.count} failed payment(s) — follow up with those customers.`);
    risks.push(`${snapshot.failedPayments.count} failed payment(s) unresolved.`);
  }
  if (snapshot.customers.atRisk > 0) {
    recommendations.push(`${snapshot.customers.atRisk} previously loyal customer(s) went quiet for 45+ days — consider a re-engagement message.`);
  }
  if (snapshot.today.visitors === 0) {
    recommendations.push('No visitor sessions logged today — share catalog updates on Instagram and WhatsApp to drive traffic.');
  } else if (snapshot.today.conversionRate < 2 && snapshot.today.visitors > 10) {
    recommendations.push(`Conversion is ${snapshot.today.conversionRate}% (${snapshot.today.orders} orders / ${snapshot.today.visitors} visitors) — review the mobile checkout flow.`);
  }
  if (snapshot.topProducts7d.length > 0) {
    recommendations.push(`Promote bestseller "${snapshot.topProducts7d[0].name}" (${snapshot.topProducts7d[0].sold} sold in 7 days) on the homepage.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Inventory is healthy and order processing is current. Monitor real-time traffic to track promotion performance.');
  }

  const summary = `Store status: ${snapshot.totals.orders} total orders, INR ${snapshot.totals.revenue30d} revenue (30 days), ${snapshot.today.orders} orders today, ${snapshot.lowStock.length + snapshot.outOfStock.length} stock alert(s), ${snapshot.abandonedCarts.pendingRecovery.length} cart recovery candidate(s), ${snapshot.pendingOrders.count} pending order(s).`;
  const reasoning = `Deterministic analysis of live database figures. ${findings.length} finding(s) triggered this run. Recommendations map 1:1 to the numbers above: stock alerts derive from current stock counts and 14-day sales velocity, cart actions from abandoned cart ages and values, order actions from status timestamps, and customer actions from order recency.`;

  return { summary, reasoning, recommendations: recommendations.slice(0, 5), risks: risks.slice(0, 3), provider: 'deterministic' };
}

export async function analyze(
  trigger: string,
  snapshot: BusinessSnapshot,
  findings: AnalysisFinding[]
): Promise<ReasoningOutput> {
  const deterministic = deterministicReasoning(trigger, snapshot, findings);

  try {
    const memoryContext = await getRecentMemoryForContext(8);
    const aiRes = await model.generate({
      system: prompts.reasoningSystem,
      messages: [
        {
          role: 'user',
          content: prompts.buildReasoningPrompt({
            trigger,
            snapshotSummary: summarizeSnapshot(snapshot),
            findings: findings.map((f) => `[${f.severity}] ${f.message}`),
          }),
        },
      ],
      json: true,
      maxTokens: 600,
      temperature: 0.2,
      timeoutMs: 25000,
    });

    if (!aiRes.ok) return deterministic;

    const parsed = JSON.parse(aiRes.text) as {
      summary?: string;
      reasoning?: string;
      recommendations?: string[];
      risks?: string[];
    };

    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary : deterministic.summary,
      reasoning: typeof parsed.reasoning === 'string' && parsed.reasoning.trim() ? parsed.reasoning : deterministic.reasoning,
      recommendations:
        Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0
          ? parsed.recommendations.filter((r) => typeof r === 'string').slice(0, 5)
          : deterministic.recommendations,
      risks: Array.isArray(parsed.risks)
        ? parsed.risks.filter((r) => typeof r === 'string').slice(0, 3)
        : deterministic.risks,
      provider: aiRes.provider === 'ollama' ? `ollama:${aiRes.model}` : aiRes.provider,
    };
  } catch {
    return deterministic;
  }
}

export { deterministicReasoning };
