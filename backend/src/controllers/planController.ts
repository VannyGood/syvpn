import { asyncHandler } from '../utils/asyncHandler.js';
import { PLANS } from '../services/planService.js';

export const listPlans = asyncHandler(async (_req, res) => {
  res.json({
    plans: Object.values(PLANS).map((p) => ({
      id: p.id,
      name: p.name,
      price_usd: p.priceUsd,
      duration_days: p.days,
    })),
  });
});

