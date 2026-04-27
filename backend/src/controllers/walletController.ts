import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const getWallet = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  // Mock: balance is sum(paid) - sum(spent). We only track deposits for now.
  const paid = await prisma.transaction.aggregate({
    where: { userId: req.user.sub, status: 'paid' },
    _sum: { amount: true },
  });

  const balance = paid._sum.amount ?? 0;
  res.json({ balance });
});

export const addFundsMock = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const amount = Number(req.body?.amount);
  const currency = String(req.body?.currency ?? '');
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Invalid amount');
  if (!['TON', 'TRC20', 'WHISH'].includes(currency)) throw new HttpError(400, 'Invalid currency');

  const tx = await prisma.transaction.create({
    data: {
      userId: req.user.sub,
      amount,
      currency: currency as 'TON' | 'TRC20' | 'WHISH',
      status: 'pending',
      approvalToken: crypto.randomUUID(),
    },
  });

  res.json({
    transaction: {
      id: tx.id,
      status: tx.status,
      amount: tx.amount,
      currency: tx.currency,
      created_at: tx.createdAt,
    },
  });
});

