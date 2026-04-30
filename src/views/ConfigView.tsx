import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Copy, Check, Download, Smartphone, Globe, ChevronRight, Sparkles } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';
import { GlowButton } from '../components/GlowButton';
import { copyText } from '../utils/copyText';

interface ConfigViewProps {
  isSubscribed: boolean;
  configUrl?: string;
  onBuyPlan: (plan: string) => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const plans = [
  { id: '1month', name: '1 Month', price: 2.99, originalPrice: null, popular: false, discount: null },
  { id: '1year', name: '1 Year', price: 32.0, originalPrice: 35.56, popular: false, discount: '10% OFF' },
];

const steps = [
  { n: 1, title: 'Download Happ VPN', desc: 'Get from app store', icon: Download },
  { n: 2, title: 'Copy Config URL', desc: 'Tap copy button above', icon: Copy },
  { n: 3, title: 'Open Happ VPN', desc: 'Launch on your phone', icon: Smartphone },
  { n: 4, title: 'Import Config', desc: 'Paste in import section', icon: Globe },
  { n: 5, title: 'Connect & Enjoy', desc: 'Browse securely!', icon: Shield },
];

export function ConfigView({ isSubscribed, configUrl, onBuyPlan, onShowToast }: ConfigViewProps) {
  const [copied, setCopied] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('1month');

  const displayConfigUrl = (() => {
    if (!configUrl) return undefined;
    // Happ supports profile naming via HTTP header `profile-title` or subscription body `#profile-title:`.
    // We proxy the Marzban subscription through our backend so Happ displays "SYVPN" consistently.
    const enc = encodeURIComponent(configUrl);
    return `/backend/tools/happ-sub?title=SYVPN&url=${enc}`;
  })();

  const handleCopy = () => {
    if (!displayConfigUrl) {
      onShowToast('No config found yet. Please subscribe first.', 'error');
      return;
    }
    void copyText(displayConfigUrl);
    setCopied(true);
    onShowToast('Config URL copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isSubscribed) {
    return (
      <div className="space-y-5">
        <div className="text-center pt-2">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center">
            <Shield className="w-7 h-7 text-neon-green" />
          </div>
          <h2 className="text-xl font-bold text-white">Your VPN Config</h2>
          <p className="text-sm text-gray-400 mt-1">Copy and import into Happ VPN</p>
        </div>

        <GlassCard glow>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400">VLESS Configuration</span>
              <span className="status-active px-2 py-0.5 rounded-md text-[10px] font-semibold">ACTIVE</span>
            </div>
            <div className="bg-dark-900/60 rounded-xl p-3">
              <code className="text-xs text-neon-blue/80 font-mono break-all leading-relaxed block max-h-24 overflow-y-auto">
                {displayConfigUrl ?? 'No config found yet.'}
              </code>
            </div>
            <GlowButton id="copy-config-btn" onClick={handleCopy} fullWidth size="lg">
              {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Config URL</>}
            </GlowButton>
          </div>
        </GlassCard>

        <div>
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-neon-purple" /> How to Use
          </h3>
          <div className="space-y-2">
            {steps.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.div key={s.n} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
                  <GlassCard className="!p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neon-blue/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-neon-blue">{s.n}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{s.title}</p>
                        <p className="text-[11px] text-gray-500">{s.desc}</p>
                      </div>
                      <Icon className="w-4 h-4 text-gray-600 shrink-0" />
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-center pt-2">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-neon-purple/10 border border-neon-purple/20 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-neon-purple" />
        </div>
        <h2 className="text-xl font-bold text-white">Choose Your Plan</h2>
        <p className="text-sm text-gray-400 mt-1">Premium VPN access, no limits</p>
      </div>

      <div className="space-y-3">
        {plans.map((plan, i) => (
          <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}>
            <GlassCard
              onClick={() => setSelectedPlan(plan.id)}
              glow={selectedPlan === plan.id}
              glowColor={plan.popular ? 'blue' : 'purple'}
              className={`transition-all duration-200 ${selectedPlan === plan.id ? '!border-neon-blue/40' : ''} ${plan.popular ? 'relative' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-md bg-neon-blue text-[10px] font-bold text-dark-900">
                  MOST POPULAR
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? 'border-neon-blue bg-neon-blue' : 'border-gray-600'}`}>
                    {selectedPlan === plan.id && <Check className="w-3 h-3 text-dark-900" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{plan.name}</p>
                    {plan.discount && <span className="text-[10px] font-semibold text-neon-green">{plan.discount}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-white">${plan.price.toFixed(2)}</p>
                  {plan.originalPrice && <p className="text-[11px] text-gray-500 line-through">${plan.originalPrice.toFixed(2)}</p>}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      <GlowButton id="buy-plan-btn" onClick={() => onBuyPlan(selectedPlan)} fullWidth size="lg">
        Subscribe Now <ChevronRight className="w-4 h-4" />
      </GlowButton>
      <p className="text-center text-[11px] text-gray-500">Funds deducted from wallet balance</p>
    </div>
  );
}
