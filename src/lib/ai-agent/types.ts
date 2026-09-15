import type { Prisma } from '@prisma/client';

export type AgentTrigger =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'SCHEDULED_SWEEP'
  | 'DAILY_SUMMARY'
  | 'MANUAL_ADMIN_TRIGGER';

export type AgentExecutionStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED';

export type SafetyLevel = 0 | 1 | 2 | 3;

export interface AIRequest {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface AIResponse {
  text: string;
  model: string;
  provider: 'ollama' | 'openai' | 'none';
  ok: boolean;
  error?: string;
}

export interface AIModel {
  generate(input: AIRequest): Promise<AIResponse>;
}

export interface BusinessSnapshot {
  now: string;
  totals: {
    orders: number;
    products: number;
    customers: number;
    revenue30d: number;
  };
  pendingOrders: {
    count: number;
    oldestHours: number | null;
  };
  failedPayments: {
    count: number;
  };
  lowStock: Array<{ id: string; name: string; stock: number }>;
  outOfStock: Array<{ id: string; name: string }>;
  fastSelling: Array<{ id: string; name: string; sold14d: number; stock: number }>;
  slowMoving: Array<{ id: string; name: string; daysSinceLastSale: number | null }>;
  abandonedCarts: {
    active: number;
    abandoned: number;
    recovered: number;
    pendingRecovery: Array<{
      id: string;
      cartToken: string;
      cartValue: number;
      ageMinutes: number;
      hasPhone: boolean;
      itemCount: number;
      itemNames: string[];
    }>;
  };
  customers: {
    total: number;
    new7d: number;
    returning: number;
    vip: number;
    inactive45d: number;
    atRisk: number;
  };
  today: {
    orders: number;
    revenue: number;
    visitors: number;
    conversionRate: number;
  };
  topProducts7d: Array<{ id: string; name: string; sold: number; revenue: number }>;
}

export interface AnalysisFinding {
  kind:
    | 'LOW_STOCK'
    | 'OUT_OF_STOCK'
    | 'RESTOCK_RECOMMENDED'
    | 'FAST_SELLING'
    | 'SLOW_MOVING'
    | 'CART_ABANDONED'
    | 'PENDING_ORDER_STALE'
    | 'FAILED_PAYMENT'
    | 'CUSTOMER_INACTIVE'
    | 'CUSTOMER_AT_RISK'
    | 'CONVERSION_LOW'
    | 'INFO';
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  productId?: string;
  cartToken?: string;
  orderId?: string;
  customerId?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface ReasoningOutput {
  summary: string;
  reasoning: string;
  recommendations: string[];
  risks: string[];
  provider: string;
}

export interface PlannedAction {
  tool: string;
  level: SafetyLevel;
  reason: string;
  input: Record<string, unknown>;
  followUps?: Array<{ tool: string; input: Record<string, unknown> }>;
}

export interface ExecutionActionRecord {
  tool: string;
  status: 'EXECUTED' | 'DEFERRED' | 'SKIPPED' | 'FAILED';
  detail?: string;
  taskId?: string;
  error?: string;
}

export interface VerificationCheck {
  check: string;
  passed: boolean;
  detail?: string;
}

export interface VerificationResult {
  verified: boolean;
  checks: VerificationCheck[];
}

export interface AgentRunResult {
  executionId: string;
  executionKey: string;
  trigger: AgentTrigger;
  status: AgentExecutionStatus;
  skippedReason?: string;
  findings?: AnalysisFinding[];
  reasoning?: string;
  model?: string;
  actionsPlanned: number;
  actionsExecuted: ExecutionActionRecord[];
  actionsDeferred: ExecutionActionRecord[];
  verification?: VerificationResult;
  error?: string;
  durationMs: number;
}

export interface AgentSettings {
  agentEnabled: boolean;
  autoSendCustomerMessages: boolean;
  customerCooldownHours: number;
  pendingOrderThresholdHours: number;
  abandonedCartIdleMinutes: number;
  lowStockThreshold: number;
  fastSellingStockMultiplier: number;
}

export type JsonInput = Prisma.InputJsonValue;
