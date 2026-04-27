import { motion } from 'framer-motion';
import { Home, Wallet, User, Shield } from 'lucide-react';
import { clsx } from 'clsx';

export type TabId = 'home' | 'wallet' | 'config' | 'profile';

interface BottomNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'wallet', label: 'Wallet', icon: Wallet },
  { id: 'config', label: 'VPN', icon: Shield },
  { id: 'profile', label: 'Profile', icon: User },
];

export function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40 glass-strong"
    >
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`nav-${tab.id}`}
              onClick={() => onTabChange(tab.id)}
              className={clsx(
                'relative flex flex-col items-center justify-center gap-0.5 w-16 h-12 rounded-xl transition-colors duration-200',
                isActive ? 'text-neon-blue' : 'text-gray-500 hover:text-gray-300'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-neon-blue/8 rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="w-5 h-5 relative z-10" strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area spacer for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
