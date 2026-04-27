import { motion } from 'framer-motion';
import { Shield, Zap, ArrowRight, CheckCircle, Clock } from 'lucide-react';
import { GlassCard } from '../components/GlassCard';

interface HomeViewProps {
  username: string;
  isSubscribed: boolean;
  daysLeft: number;
  onNavigate: (tab: 'wallet' | 'config') => void;
}

export function HomeView({ username, isSubscribed, daysLeft, onNavigate }: HomeViewProps) {
  return (
    <div className="space-y-5">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center pt-2 pb-3"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-neon-blue/10 border border-neon-blue/20 mb-4">
          <div className="w-2 h-2 rounded-full bg-neon-blue animate-[glow-pulse_2s_ease-in-out_infinite]" />
          <span className="text-xs font-medium text-neon-blue">Secure & Private</span>
        </div>
        <h1 className="text-3xl font-bold mb-2">
          Welcome, <span className="text-gradient">{username}</span>
        </h1>
        <p className="text-gray-400 text-sm">Your premium VPN experience awaits</p>
      </motion.div>

      {/* Status Card */}
      <GlassCard glow glowColor={isSubscribed ? 'blue' : 'purple'}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${isSubscribed ? 'bg-neon-green/15' : 'bg-neon-pink/15'}`}>
              {isSubscribed
                ? <CheckCircle className="w-5 h-5 text-neon-green" />
                : <Clock className="w-5 h-5 text-neon-pink" />
              }
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {isSubscribed ? 'Plan Active' : 'No Active Plan'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {isSubscribed ? `${daysLeft} days remaining` : 'Subscribe to get started'}
              </p>
            </div>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${isSubscribed ? 'status-active' : 'status-inactive'}`}>
            {isSubscribed ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
      </GlassCard>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard
          onClick={() => onNavigate('config')}
          className="group hover:border-neon-blue/20 transition-all duration-300"
        >
          <div className="flex flex-col items-center text-center gap-2.5 py-2">
            <div className="w-10 h-10 rounded-xl bg-neon-blue/10 flex items-center justify-center group-hover:bg-neon-blue/20 transition-colors">
              <Shield className="w-5 h-5 text-neon-blue" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {isSubscribed ? 'Get Config' : 'Buy Plan'}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {isSubscribed ? 'Copy your VPN config' : 'Starting $2.99/mo'}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard
          onClick={() => onNavigate('wallet')}
          className="group hover:border-neon-purple/20 transition-all duration-300"
        >
          <div className="flex flex-col items-center text-center gap-2.5 py-2">
            <div className="w-10 h-10 rounded-xl bg-neon-purple/10 flex items-center justify-center group-hover:bg-neon-purple/20 transition-colors">
              <Zap className="w-5 h-5 text-neon-purple" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Add Funds</p>
              <p className="text-[11px] text-gray-500 mt-0.5">TON · TRC20 · Whish</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Features */}
      <GlassCard>
        <h3 className="text-sm font-semibold text-white mb-3">Why SY VPN?</h3>
        <div className="space-y-3">
          {[
            { title: 'Ultra-Fast Servers', desc: 'Optimized for streaming & gaming', color: 'text-neon-blue' },
            { title: 'Zero Logs Policy', desc: 'Your privacy is our priority', color: 'text-neon-green' },
            { title: 'Easy Setup', desc: 'One-tap config via Happ VPN app', color: 'text-neon-purple' },
          ].map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.1 }}
              className="flex items-center gap-3"
            >
              <ArrowRight className={`w-4 h-4 ${feature.color} shrink-0`} />
              <div>
                <p className="text-sm font-medium text-white">{feature.title}</p>
                <p className="text-xs text-gray-500">{feature.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
