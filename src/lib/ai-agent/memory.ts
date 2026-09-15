import prisma from '@/lib/prisma';
import type { JsonInput } from './types';
import type { AgentSettings } from './types';
import { DEFAULT_SETTINGS } from './policies';

const SETTINGS_KEY = 'system/agent_settings';
const MAX_FACT_VALUE_LENGTH = 4000;

export async function getAgentSettings(): Promise<AgentSettings> {
  const row = await prisma.agentMemory.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(row.value) as Partial<AgentSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveAgentSettings(update: Partial<AgentSettings>): Promise<AgentSettings> {
  const current = await getAgentSettings();
  const next: AgentSettings = { ...current, ...update };
  const value = JSON.stringify(next);
  await prisma.agentMemory.upsert({
    where: { key: SETTINGS_KEY },
    update: { value, category: 'SYSTEM' },
    create: { key: SETTINGS_KEY, value, category: 'SYSTEM' },
  });
  return next;
}

export async function saveMemoryFact(input: {
  key: string;
  category: 'FACT' | 'PATTERN' | 'DECISION' | 'PREFERENCE' | 'BUSINESS_RULE' | 'SYSTEM';
  value: string;
  metadata?: JsonInput;
}): Promise<void> {
  const value = input.value.slice(0, MAX_FACT_VALUE_LENGTH);
  await prisma.agentMemory.upsert({
    where: { key: input.key },
    update: { value, category: input.category, ...(input.metadata ? { metadata: input.metadata } : {}) },
    create: {
      key: input.key,
      value,
      category: input.category,
      ...(input.metadata ? { metadata: input.metadata } : {}),
    },
  });
}

export async function getMemoryByCategories(categories: string[], take = 20): Promise<
  Array<{ key: string; category: string; value: string }>
> {
  const rows = await prisma.agentMemory.findMany({
    where: { category: { in: categories }, key: { not: SETTINGS_KEY } },
    orderBy: { updatedAt: 'desc' },
    take,
    select: { key: true, category: true, value: true },
  });
  return rows;
}

export async function getRecentMemoryForContext(take = 10): Promise<string> {
  const rows = await getMemoryByCategories(['FACT', 'PATTERN', 'DECISION', 'BUSINESS_RULE'], take);
  if (rows.length === 0) return 'No prior agent memory.';
  return rows
    .map((r) => `- [${r.category}] ${r.key}: ${r.value.slice(0, 300)}`)
    .join('\n');
}
