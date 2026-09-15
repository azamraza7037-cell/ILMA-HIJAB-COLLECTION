import type { SafetyLevel } from './types';
import type { AgentSettings } from './types';

export interface ToolPolicy {
  name: string;
  level: SafetyLevel;
  description: string;
}

/**
 * Safety policy levels:
 * 0 = read only (auto allowed)
 * 1 = safe internal action (auto allowed)
 * 2 = customer communication (approval / cooldown rules)
 * 3 = financial / high impact (explicit admin approval, always)
 */
export const TOOL_POLICIES: Record<string, ToolPolicy> = {
  getOrders: { name: 'getOrders', level: 0, description: 'Read orders with filters' },
  getOrder: { name: 'getOrder', level: 0, description: 'Read a single order with items' },
  getProducts: { name: 'getProducts', level: 0, description: 'Read products with filters' },
  getProduct: { name: 'getProduct', level: 0, description: 'Read a single product' },
  getInventory: { name: 'getInventory', level: 0, description: 'Read stock levels and velocity' },
  getCustomers: { name: 'getCustomers', level: 0, description: 'Read customers with segment filter' },
  getCustomer: { name: 'getCustomer', level: 0, description: 'Read a single customer' },
  getAnalytics: { name: 'getAnalytics', level: 0, description: 'Read funnel and traffic analytics' },
  getAbandonedCarts: { name: 'getAbandonedCarts', level: 0, description: 'Read abandoned carts' },
  createNotification: { name: 'createNotification', level: 1, description: 'Create internal admin notification' },
  createAutomationTask: { name: 'createAutomationTask', level: 1, description: 'Create an internal automation task' },
  updateAbandonedCartContact: { name: 'updateAbandonedCartContact', level: 1, description: 'Mark cart as contacted internally' },
  generateBusinessReport: { name: 'generateBusinessReport', level: 1, description: 'Generate and persist a business report' },
  sendWhatsAppMessage: { name: 'sendWhatsAppMessage', level: 2, description: 'Send a WhatsApp message to a customer' },
  updateOrderStatus: { name: 'updateOrderStatus', level: 3, description: 'Change an order status (high impact)' },
};

export const DEFAULT_SETTINGS: AgentSettings = {
  agentEnabled: true,
  autoSendCustomerMessages: false,
  customerCooldownHours: 24,
  pendingOrderThresholdHours: 24,
  abandonedCartIdleMinutes: 30,
  lowStockThreshold: 5,
  fastSellingStockMultiplier: 2,
};

export function getToolLevel(tool: string): SafetyLevel {
  return TOOL_POLICIES[tool]?.level ?? 3;
}

export function getToolPolicy(tool: string): ToolPolicy | undefined {
  return TOOL_POLICIES[tool];
}

export function isToolRegistered(tool: string): boolean {
  return Object.prototype.hasOwnProperty.call(TOOL_POLICIES, tool);
}

/**
 * Decide whether an action may auto-execute or must go to the approval queue.
 * Level 3 actions ALWAYS require approval. Level 2 requires approval unless
 * the admin explicitly enabled auto-send AND the customer cooldown has passed.
 */
export function evaluateActionPolicy(opts: {
  tool: string;
  settings: AgentSettings;
}): { autoExecute: boolean; reason: string } {
  const policy = getToolPolicy(opts.tool);
  if (!policy) {
    return { autoExecute: false, reason: 'Unknown tool — blocked by policy' };
  }
  if (policy.level <= 1) {
    return { autoExecute: true, reason: `Level ${policy.level} safe action` };
  }
  if (policy.level >= 3) {
    return { autoExecute: false, reason: 'Level 3 high-impact action requires admin approval' };
  }
  if (opts.settings.autoSendCustomerMessages) {
    return { autoExecute: true, reason: 'Level 2 auto-send enabled by admin (cooldown still enforced)' };
  }
  return { autoExecute: false, reason: 'Level 2 customer communication requires approval' };
}
