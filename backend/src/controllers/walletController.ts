import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const getWallet = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  // Balance = paid deposits - paid purchases (USD)
  const [deposits, purchases] = await Promise.all([
    prisma.transaction.aggregate({
      where: { userId: req.user.sub, status: 'paid', kind: 'deposit' },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { userId: req.user.sub, status: 'paid', kind: 'purchase' },
      _sum: { amount: true },
    }),
  ]);

  const depositSum = deposits._sum.amount ?? 0;
  const purchaseSum = purchases._sum.amount ?? 0;
  const balance = Number(depositSum) - Number(purchaseSum);
  res.json({ balance });
});

export const listTransactions = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const txs = await prisma.transaction.findMany({
    where: { userId: req.user.sub },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  res.json({
    transactions: txs.map((t) => ({
      id: t.id,
      kind: t.kind,
      status: t.status,
      amount: String(t.amount),
      currency: t.currency,
      created_at: t.createdAt,
    })),
  });
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
      kind: 'deposit',
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

