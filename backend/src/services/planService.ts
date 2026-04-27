import { HttpError } from '../utils/httpError.js';

export type PlanId = 'monthly' | 'yearly';

export const PLANS: Record<PlanId, { id: PlanId; name: string; priceUsd: number; days: number }> = {
  monthly: { id: 'monthly', name: 'Monthly', priceUsd: 2.99, days: 30 },
  yearly: { id: 'yearly', name: 'Yearly', priceUsd: 32.0, days: 365 },
};

export function requirePlan(id: string) {
  if (id !== 'monthly' && id !== 'yearly') throw new HttpError(400, 'Invalid plan_type');
  return PLANS[id];
}

