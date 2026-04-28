import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { User, Shield, HelpCircle, MessageCircle, ChevronDown } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';

interface ProfileViewProps {
  username: string;
  firstName: string;
  isSubscribed: boolean;
  daysLeft: number;
  planName: string;
}

export function ProfileView({ username, firstName, isSubscribed, daysLeft, planName }: ProfileViewProps) {
  const [faqOpen, setFaqOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>('what-is-vpn');

  const faqItems = [
    {
      id: 'what-is-vpn',
      q: 'What is a VPN and why use it?',
      a: 'A VPN encrypts your internet traffic and hides your IP address. It helps protect your privacy on public Wi‑Fi, reduces tracking, and lets you access services more securely.',
    },
    {
      id: 'speed',
      q: 'Will a VPN slow down my internet?',
      a: 'Some slowdown is normal due to encryption and routing, but good servers keep it minimal. Choose the closest server region and avoid congested times for best speed.',
    },
    {
      id: 'setup',
      q: 'How do I connect after buying a plan?',
      a: 'Go to the VPN tab, copy your config link, then import it into Happ VPN. After import, tap connect and you’re protected.',
    },
    {
      id: 'not-working',
      q: 'Connection not working — what should I do?',
      a: 'Try switching networks (Wi‑Fi/4G), re-importing the config, and restarting the VPN app. If it still fails, contact support and share your Telegram username + screenshot.',
    },
  ];

  const menuItems = [
    { icon: MessageCircle, label: 'Contact Support', desc: 'Get help via Telegram', action: () => window.open('https://t.me/BossKingz1', '_blank') },
    { icon: HelpCircle, label: 'FAQ', desc: 'Common questions', action: () => setFaqOpen((v) => !v) },
  ];

  return (
    <div className="space-y-5">
      {/* Avatar & Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center pt-2"
      >
        <div className="w-20 h-20 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-neon-blue/20 to-neon-purple/20 border border-white/10 flex items-center justify-center">
          <User className="w-9 h-9 text-neon-blue" />
        </div>
        <h2 className="text-xl font-bold text-white">{firstName || 'User'}</h2>
        <p className="text-sm text-gray-400">@{username}</p>
      </motion.div>

      {/* Subscription Info */}
      <GlassCard glow glowColor={isSubscribed ? 'blue' : 'purple'}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-neon-blue" />
              <span className="text-sm font-semibold text-white">Subscription</span>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${isSubscribed ? 'status-active' : 'status-inactive'}`}>
              {isSubscribed ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>
          {isSubscribed && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dark-900/40 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-0.5">Plan</p>
                <p className="text-sm font-semibold text-white">{planName}</p>
              </div>
              <div className="bg-dark-900/40 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400 mb-0.5">Expires in</p>
                <p className="text-sm font-semibold text-neon-blue">{daysLeft} days</p>
              </div>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Menu Items */}
      <div className="space-y-2">
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
            >
              <GlassCard onClick={item.action} className="!p-3 hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">{item.label}</p>
                    <p className="text-[11px] text-gray-500">{item.desc}</p>
                  </div>
                  {item.label === 'FAQ' && (
                    <motion.div
                      animate={{ rotate: faqOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gray-500"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  )}
                </div>
              </GlassCard>
            </motion.div>
          );
        })}
      </div>

      {/* FAQ */}
      <AnimatePresence initial={false}>
        {faqOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {faqItems.map((item) => {
              const isOpen = openFaqId === item.id;
              return (
                <GlassCard
                  key={item.id}
                  onClick={() => setOpenFaqId(isOpen ? null : item.id)}
                  className="!p-3 hover:border-white/10 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <HelpCircle className="w-4 h-4 text-gray-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.q}</p>
                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.p
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                            className="text-[11px] text-gray-500 mt-1 overflow-hidden"
                          >
                            {item.a}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-gray-600 pt-0.5"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </motion.div>
                  </div>
                </GlassCard>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* App Version */}
      <p className="text-center text-[11px] text-gray-600 pt-2">
        SY VPN v1.0.0 • Built with ❤️
      </p>
    </div>
  );
}
