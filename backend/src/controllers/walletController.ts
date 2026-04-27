import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';

export const getWallet = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  // Compute in Postgres to avoid JS float/Decimal edge cases.
  const rows = await prisma.$queryRaw<{ balance: any }[]>`
    SELECT
      COALESCE(
        SUM(
          CASE
            WHEN status = 'paid' AND kind = 'deposit' THEN amount
            WHEN status = 'paid' AND kind = 'purchase' THEN -amount
            ELSE 0
          END
        ),
        0
      )::text AS balance
    FROM transactions
    WHERE user_id = ${req.user.sub}
  `;

  const balanceStr = rows?.[0]?.balance ?? '0';
  res.json({ balance: Number(balanceStr) });
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

