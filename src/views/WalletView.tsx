import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Copy } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlowButton } from '../components/GlowButton';
import { copyText } from '../utils/copyText';
import { iPaid } from '../api/client';
import toncoinIcon from '../assets/toncoin.png';
import trc20Icon from '../assets/trc20.png';
import whishIcon from '../assets/whish.jpg';

interface WalletViewProps {
  balance: number;
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type PaymentMethod = 'ton' | 'trc20' | 'whish';

const mockTransactions = [
  { id: 1, type: 'deposit', method: 'TON', amount: 5.0, date: '2025-04-20', status: 'completed' },
  { id: 2, type: 'purchase', method: 'Plan', amount: -3.0, date: '2025-04-18', status: 'completed' },
  { id: 3, type: 'deposit', method: 'TRC20', amount: 10.0, date: '2025-04-15', status: 'completed' },
];

const depositAddresses: Record<PaymentMethod, { address: string; label: string }> = {
  ton: { address: 'UQBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', label: 'TON Wallet' },
  trc20: { address: 'TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', label: 'TRC20 (USDT)' },
  whish: { address: 'SY_VPN_WHISH', label: 'Whish Money' },
};

export function WalletView({ balance, onShowToast }: WalletViewProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [paidActionVisible, setPaidActionVisible] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [processingSecondsLeft, setProcessingSecondsLeft] = useState(0);

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

    // Immediate feedback so we can confirm the tap handler fires in mobile WebViews.
    onShowToast('Submitting payment…', 'info');

    const currencyMap: Record<PaymentMethod, 'TON' | 'TRC20' | 'WHISH'> = {
      ton: 'TON',
      trc20: 'TRC20',
      whish: 'WHISH',
    };

    const methodToUse: PaymentMethod = selectedMethod ?? 'ton';

    // For now, we send the user-entered deposit as a fixed amount placeholder.
    // Next step: tie this to selected plan and show exact amount.
    const amount = 2.99;

    setPaymentProcessing(true);
    setProcessingSecondsLeft(0);
    onShowToast('Sent to admin for review. You’ll be approved shortly.', 'info');

    void iPaid({ amount, currency: currencyMap[methodToUse] })
      .then(() => {
        setPaidActionVisible(false);
        onShowToast('Payment submitted. Waiting for admin approval.', 'success');
      })
      .catch((e) => {
        onShowToast((e as Error).message || 'Failed to submit payment', 'error');
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
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'ton' as PaymentMethod, label: 'TON', iconSrc: toncoinIcon },
            { id: 'trc20' as PaymentMethod, label: 'TRC20', iconSrc: trc20Icon },
            { id: 'whish' as PaymentMethod, label: 'Whish', iconSrc: whishIcon },
          ]).map((method) => (
            <GlassCard
              key={method.id}
              onClick={() => setSelectedMethod(selectedMethod === method.id ? null : method.id)}
              className={`text-center transition-all duration-200 ${
                selectedMethod === method.id ? '!border-neon-blue/40 glow-blue' : ''
              }`}
            >
              <img
                src={method.iconSrc}
                alt={method.label}
                className="w-7 h-7 object-contain mx-auto mb-1"
                loading="lazy"
              />
              <p className="text-xs font-semibold text-white">{method.label}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Deposit Address */}
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
                <p className="text-xs font-medium text-gray-400">
                  Send {depositAddresses[selectedMethod].label} to:
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
                  <div className="space-y-2">
                    <GlowButton
                      id="i-have-paid-btn"
                      fullWidth
                      size="lg"
                      onClick={startPaymentProcessing}
                      onPointerDown={startPaymentProcessing}
                      onTouchStart={startPaymentProcessing}
                      disabled={paymentProcessing}
                    >
                      {paymentProcessing ? (
                        <>
                          <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          Processing…
                        </>
                      ) : (
                        'I have paid'
                      )}
                    </GlowButton>

                    {paymentProcessing && (
                      <p className="text-[11px] text-gray-500 text-center">
                        Checking payment… {Math.floor(processingSecondsLeft / 60)}:
                        {String(processingSecondsLeft % 60).padStart(2, '0')}
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
          {mockTransactions.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
            >
              <GlassCard className="!p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                    tx.type === 'deposit' ? 'bg-neon-green/10' : 'bg-neon-pink/10'
                  }`}>
                    {tx.type === 'deposit'
                      ? <ArrowDownLeft className="w-4 h-4 text-neon-green" />
                      : <ArrowUpRight className="w-4 h-4 text-neon-pink" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white">{tx.method}</p>
                    <p className="text-[11px] text-gray-500">{tx.date}</p>
                  </div>
                  <span className={`text-sm font-semibold ${
                    tx.amount >= 0 ? 'text-neon-green' : 'text-neon-pink'
                  }`}>
                    {tx.amount >= 0 ? '+' : ''}${Math.abs(tx.amount).toFixed(2)}
                  </span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
