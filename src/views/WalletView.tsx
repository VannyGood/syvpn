import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Copy } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlowButton } from '../components/GlowButton';
import { copyText } from '../utils/copyText';
import { getWalletTransactions, iPaid, type WalletTransaction } from '../api/client';
import toncoinIcon from '../assets/toncoin.png';
import trc20Icon from '../assets/trc20.png';
import whishIcon from '../assets/whish.jpg';

interface WalletViewProps {
  balance: number;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type PaymentMethod = 'ton' | 'trc20' | 'whish';

function formatDate(iso: string) {
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return iso;
  }
}

const depositAddresses: Record<PaymentMethod, { address: string; label: string }> = {
  ton: { address: 'UQAY0pUwY8fkhDqyqM8Ac2MKg7go4QLiqo1OtP836vBjmLbi', label: 'USDT on TON' },
  trc20: { address: 'TMVy2tQnWfJcatM1ttVrRypa1TuGu6VxQK', label: 'USDT on TRC20' },
  whish: { address: '', label: 'Whish Money' },
};

export function WalletView({ balance, onShowToast }: WalletViewProps) {
  const PENDING_DEPOSIT_LS_KEY = 'syvpn_pending_deposit_tx_id';

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paidActionVisible, setPaidActionVisible] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [awaitingAdmin, setAwaitingAdmin] = useState(false);
  const [pendingTxId, setPendingTxId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PENDING_DEPOSIT_LS_KEY);
    } catch {
      return null;
    }
  });
  const [pendingStartedAtMs, setPendingStartedAtMs] = useState<number>(() => Date.now());
  const [pendingElapsedSec, setPendingElapsedSec] = useState(0);
  const [amountInput, setAmountInput] = useState('3');
  const [depositAgreed, setDepositAgreed] = useState(false);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);

  const amountValue = useMemo(() => {
    const n = Number(amountInput);
    return Number.isFinite(n) ? n : NaN;
  }, [amountInput]);

  const networkFee = useMemo(() => {
    if (selectedMethod === 'ton') return 0.7;
    if (selectedMethod === 'trc20') return 1.2;
    return 0;
  }, [selectedMethod]);

  const recommendedToSend = useMemo(() => {
    if (!Number.isFinite(amountValue) || amountValue <= 0) return NaN;
    return Math.max(0, amountValue + networkFee);
  }, [amountValue, networkFee]);

  const pendingTx = useMemo(() => {
    if (!pendingTxId) return null;
    return transactions.find((t) => t.id === pendingTxId) ?? null;
  }, [pendingTxId, transactions]);

  useEffect(() => {
    let cancelled = false;
    void getWalletTransactions()
      .then((r) => {
        if (cancelled) return;
        setTransactions(r.transactions);

        // If we have a pending tx id saved, resume "waiting for admin" mode.
        if (pendingTxId) {
          const tx = r.transactions.find((t) => t.id === pendingTxId);
          if (tx?.kind === 'deposit' && tx.status === 'pending') {
            setAwaitingAdmin(true);
            setPaidActionVisible(true);
            setDepositAgreed(true);
          } else if (tx && (tx.status === 'paid' || tx.status === 'declined')) {
            // Already resolved (user reopened later) — clear local pending.
            try {
              localStorage.removeItem(PENDING_DEPOSIT_LS_KEY);
            } catch {}
            setPendingTxId(null);
            setAwaitingAdmin(false);
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pendingTxId]);

  // While awaiting admin decision, poll transactions until this tx becomes paid/declined.
  useEffect(() => {
    if (!awaitingAdmin || !pendingTxId) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const r = await getWalletTransactions();
        if (cancelled) return;
        setTransactions(r.transactions);

        const tx = r.transactions.find((t) => t.id === pendingTxId);
        if (!tx) return;

        if (tx.status === 'paid') {
          onShowToast('✅ Payment approved. Balance updated.', 'success');
          setAwaitingAdmin(false);
          setPaidActionVisible(false);
          try {
            localStorage.removeItem(PENDING_DEPOSIT_LS_KEY);
          } catch {}
          setPendingTxId(null);
        } else if (tx.status === 'declined') {
          onShowToast('❌ Payment declined. If this is a mistake, contact support.', 'error');
          setAwaitingAdmin(false);
          setPaidActionVisible(false);
          try {
            localStorage.removeItem(PENDING_DEPOSIT_LS_KEY);
          } catch {}
          setPendingTxId(null);
        }
      } catch {
        // ignore; we'll try again
      }
    };

    // Run immediately, then poll.
    void tick();
    const id = window.setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [awaitingAdmin, pendingTxId, onShowToast, pendingTxId]);

  // Simple elapsed timer for the "processing" message.
  useEffect(() => {
    if (!awaitingAdmin) return;
    setPendingElapsedSec(Math.max(0, Math.floor((Date.now() - pendingStartedAtMs) / 1000)));
    const id = window.setInterval(() => {
      setPendingElapsedSec(Math.max(0, Math.floor((Date.now() - pendingStartedAtMs) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [awaitingAdmin, pendingStartedAtMs]);

  const handleCopy = async (method: PaymentMethod, text: string) => {
    try {
      await copyText(text);
      onShowToast('Address copied to clipboard!', 'success');
      // Ensure we always keep the selected payment method in sync with the copied address.
      setSelectedMethod(method);
      setPaidActionVisible(true);
    } catch {
      onShowToast('Copy failed on this device. Please copy manually.', 'error');
    }
  };

  const startPaymentProcessing = () => {
    if (paymentProcessing) {
      onShowToast('Already submitting your payment…', 'info');
      return;
    }

    if (awaitingAdmin) {
      onShowToast('Payment is already submitted. Waiting for admin approval…', 'info');
      return;
    }

    if (selectedMethod === 'whish') {
      onShowToast('Whish is coming soon.', 'info');
      return;
    }

    const amount = amountValue;
    if (!Number.isFinite(amount) || amount <= 0) {
      onShowToast('Enter a valid amount (e.g. 3 USDT).', 'error');
      return;
    }

    // Immediate feedback so we can confirm the tap handler fires in mobile WebViews.
    onShowToast('Submitting payment…', 'info');

    const currencyMap: Record<PaymentMethod, 'TON' | 'TRC20' | 'WHISH'> = {
      ton: 'TON',
      trc20: 'TRC20',
      whish: 'WHISH',
    };

    const methodToUse: PaymentMethod = selectedMethod ?? 'ton';

    setPaymentProcessing(true);
    onShowToast('Sent to admin for review. Waiting for confirmation…', 'info');

    void iPaid({ amount, currency: currencyMap[methodToUse] })
      .then((resp) => {
        setPaidActionVisible(false);
        setAwaitingAdmin(true);
        setPendingStartedAtMs(Date.now());
        const txId = resp?.transaction?.id;
        if (txId) {
          setPendingTxId(txId);
          try {
            localStorage.setItem(PENDING_DEPOSIT_LS_KEY, txId);
          } catch {}
        }
        onShowToast('Payment submitted. Waiting for admin approval.', 'success');
        return getWalletTransactions();
      })
      .then((r) => {
        if (r) setTransactions(r.transactions);
      })
      .catch((e) => {
        onShowToast((e as Error).message || 'Failed to submit payment', 'error');
        setAwaitingAdmin(false);
        try {
          localStorage.removeItem(PENDING_DEPOSIT_LS_KEY);
        } catch {}
        setPendingTxId(null);
      })
      .finally(() => {
        setPaymentProcessing(false);
      });

  };

  return (
    <div className="space-y-5">
      {/* Balance Card */}
      <GlassCard glow glowColor="blue">
        <div className="text-center py-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 mb-3">
            <Wallet className="w-3.5 h-3.5 text-neon-blue" />
            <span className="text-xs text-gray-400 font-medium">Available Balance</span>
          </div>
          <motion.p
            key={balance}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="text-4xl font-bold text-gradient"
          >
            ${balance.toFixed(2)}
          </motion.p>
          <p className="text-xs text-gray-500 mt-1">≈ {(balance / 2.1).toFixed(2)} TON</p>
        </div>
      </GlassCard>

      {/* Add Funds */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-neon-blue" />
          Add Funds
        </h3>
        <p className="text-[11px] text-gray-500 mb-3">
          Pay with <span className="text-gray-300 font-medium">USDT</span>. Choose the network you want to use.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'ton' as PaymentMethod, label: 'TON', iconSrc: toncoinIcon, disabled: false, subtitle: 'USDT' },
            { id: 'trc20' as PaymentMethod, label: 'TRC20', iconSrc: trc20Icon, disabled: false, subtitle: 'USDT' },
            { id: 'whish' as PaymentMethod, label: 'Whish', iconSrc: whishIcon, disabled: true },
          ]).map((method) => (
            <GlassCard
              key={method.id}
              onClick={
                method.disabled
                  ? () => onShowToast('Whish is coming soon.', 'info')
                  : () => {
                    const next = selectedMethod === method.id ? null : method.id;
                    setSelectedMethod(next);
                    setDepositAgreed(false);
                    setPaidActionVisible(false);
                  }
              }
              className={`text-center transition-all duration-200 ${
                method.disabled
                  ? 'opacity-40 pointer-events-none'
                  : selectedMethod === method.id
                    ? '!border-neon-blue/40 glow-blue'
                    : ''
              }`}
            >
              <img
                src={method.iconSrc}
                alt={method.label}
                className="w-7 h-7 object-contain mx-auto mb-1"
                loading="lazy"
              />
              <p className="text-xs font-semibold text-white">{method.label}</p>
              {!method.disabled && method.subtitle && (
                <p className="text-[10px] text-gray-500 mt-0.5">{method.subtitle}</p>
              )}
              {method.disabled && (
                <p className="text-[10px] text-gray-500 mt-0.5">Coming soon</p>
              )}
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Deposit Setup */}
      <AnimatePresence>
        {selectedMethod && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
          >
            <GlassCard glow>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-gray-400">Amount (USDT)</label>
                  <input
                    inputMode="decimal"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    placeholder="e.g. 3"
                    className="w-full bg-dark-900/50 rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:outline-none focus:border-neon-blue/40"
                  />
                </div>

                {selectedMethod && selectedMethod !== 'whish' && (
                  <div className="bg-dark-900/35 rounded-xl p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-gray-500">Network fee</p>
                      <p className="text-[11px] text-gray-300 font-medium">+{networkFee.toFixed(2)} USDT</p>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-xs text-gray-300 font-medium">Recommended to send</p>
                      <p className="text-xs text-white font-semibold">
                        {Number.isFinite(recommendedToSend) ? `${recommendedToSend.toFixed(2)} USDT` : '—'}
                      </p>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-1">
                      This helps cover network costs so your wallet credits correctly.
                    </p>
                  </div>
                )}

                {!depositAgreed ? (
                  <GlowButton
                    id="deposit-agree-btn"
                    fullWidth
                    size="lg"
                    variant="secondary"
                    onClick={() => {
                      const amount = amountValue;
                      if (!Number.isFinite(amount) || amount <= 0) {
                        onShowToast('Enter a valid amount (e.g. 3 USDT).', 'error');
                        return;
                      }
                      setDepositAgreed(true);
                      if (Number.isFinite(recommendedToSend)) {
                        onShowToast(`Send ${recommendedToSend.toFixed(2)} USDT on the selected network.`, 'info');
                      } else {
                        onShowToast('Copy the address and send your USDT payment on the selected network.', 'info');
                      }
                    }}
                  >
                    I agree
                  </GlowButton>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-400">
                      Send{' '}
                      <span className="text-gray-300 font-medium">
                        {Number.isFinite(recommendedToSend) ? `${recommendedToSend.toFixed(2)} USDT` : 'USDT'}
                      </span>{' '}
                      to ({depositAddresses[selectedMethod].label}):
                    </p>
                    <div className="flex items-center gap-2 bg-dark-900/50 rounded-xl p-3">
                      <code className="text-xs text-neon-blue flex-1 break-all font-mono">
                        {depositAddresses[selectedMethod].address}
                      </code>
                      <button
                        onClick={() => void handleCopy(selectedMethod, depositAddresses[selectedMethod].address)}
                        className="p-2 rounded-lg bg-neon-blue/10 hover:bg-neon-blue/20 transition-colors shrink-0"
                      >
                        <Copy className="w-3.5 h-3.5 text-neon-blue" />
                      </button>
                    </div>

                    {paidActionVisible && (
                      <GlowButton
                        id="i-have-paid-btn"
                        fullWidth
                        size="lg"
                        onClick={startPaymentProcessing}
                        onPointerDown={startPaymentProcessing}
                        onTouchStart={startPaymentProcessing}
                        disabled={paymentProcessing || awaitingAdmin}
                      >
                        {paymentProcessing || awaitingAdmin ? (
                          <>
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            {awaitingAdmin ? 'Waiting for confirmation…' : 'Submitting…'}
                          </>
                        ) : (
                          'I have paid'
                        )}
                      </GlowButton>
                    )}

                    <GlowButton
                      id="deposit-reset-btn"
                      fullWidth
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDepositAgreed(false);
                        setPaidActionVisible(false);
                      }}
                    >
                      Change amount
                    </GlowButton>

                    {awaitingAdmin && (
                      <p className="text-[11px] text-gray-500 text-center">
                        Payment is processing. This usually takes a few minutes.
                        {pendingTx?.status === 'pending' ? (
                          <>
                            {' '}
                            Elapsed {Math.floor(pendingElapsedSec / 60)}:
                            {String(pendingElapsedSec % 60).padStart(2, '0')}.
                          </>
                        ) : null}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-[11px] text-gray-500">
                  ⚡ Deposits are processed within 5–15 minutes
                </p>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction History */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
        <div className="space-y-2">
          {transactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <GlassCard className="!p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    tx.kind === 'deposit' ? 'bg-neon-green/10' : 'bg-neon-pink/10'
                  }`}>
                    {tx.kind === 'deposit'
                      ? <ArrowDownLeft className="w-4 h-4 text-neon-green" />
                      : <ArrowUpRight className="w-4 h-4 text-neon-pink" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">
                      {tx.kind === 'deposit' ? tx.currency : 'Plan purchase'}
                      {' '}
                      <span className="text-[11px] text-gray-500">({tx.status})</span>
                    </p>
                    <p className="text-[11px] text-gray-500">{formatDate(tx.created_at)}</p>
                  </div>
                  <span className={`text-sm font-semibold ${
                    tx.kind === 'deposit' ? 'text-neon-green' : 'text-neon-pink'
                  }`}>
                    {tx.kind === 'deposit' ? '+' : '-'}${Number(tx.amount).toFixed(2)}
                  </span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
          {transactions.length === 0 && (
            <GlassCard className="!p-3">
              <p className="text-[11px] text-gray-500 text-center">No transactions yet.</p>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
