import crypto from 'node:crypto';
import { prisma } from '../config/prisma.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import { notifyAdmin } from '../services/telegramNotify.js';
import { env } from '../config/env.js';

export const iPaid = asyncHandler(async (req, res) => {
  if (!req.user) throw new HttpError(401, 'Unauthorized');

  const amount = Number(req.body?.amount);
  const currency = String(req.body?.currency ?? '');
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Invalid amount');
  if (!['TON', 'TRC20', 'WHISH'].includes(currency)) throw new HttpError(400, 'Invalid currency');

  const approvalToken = crypto.randomUUID();

  console.log('[iPaid] request', {
    userId: req.user.sub,
    telegramId: req.user.telegramId,
    amount,
    currency,
  });

  const tx = await prisma.transaction.create({
    data: {
      userId: req.user.sub,
      amount,
      currency: currency as 'TON' | 'TRC20' | 'WHISH',
      status: 'pending',
      approvalToken,
    },
  });

  const approveUrl = `${env.PUBLIC_BASE_URL}/backend/admin/transactions/approve?token=${encodeURIComponent(approvalToken)}`;

  await notifyAdmin(
    [
      '💳 Payment pending approval',
      `UserId: ${req.user.sub}`,
      `TelegramId: ${req.user.telegramId}`,
      `Amount: ${amount} ${currency}`,
      `Transaction: ${tx.id}`,
      '',
      `Approve: ${approveUrl}`,
    ].join('\n')
  );

  console.log('[iPaid] ok', { txId: tx.id });

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

export const approveTransaction = asyncHandler(async (req, res) => {
  const token = typeof req.query?.token === 'string' ? req.query.token : '';
  if (!token) throw new HttpError(400, 'Missing token');

  const tx = await prisma.transaction.findUnique({ where: { approvalToken: token } as any });
  if (!tx) throw new HttpError(404, 'Transaction not found');

  if (tx.status === 'paid') {
    return res.json({ ok: true, message: 'Already approved', transaction_id: tx.id });
  }

  await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: 'paid' },
  });

  return res.json({ ok: true, message: 'Approved', transaction_id: tx.id });
});

