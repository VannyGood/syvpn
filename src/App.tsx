import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import WebApp from '@twa-dev/sdk';
import { BottomNav } from './components/BottomNav';
import type { TabId } from './components/BottomNav';
import { Toast } from './components/Toast';
import type { ToastType } from './components/Toast';
import { HomeView } from './views/HomeView';
import { WalletView } from './views/WalletView';
import { ConfigView } from './views/ConfigView';
import { ProfileView } from './views/ProfileView';
import './index.css';
import { getConfig, getWallet, getWalletTransactions, subscribe, telegramAuth } from './api/client';

const planPrices: Record<string, { price: number; days: number; name: string }> = {
  '1month': { price: 2.99, days: 30, name: '1 Month' },
  '1year': { price: 32.0, days: 365, name: '1 Year' },
};

function daysUntil(iso: string) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function getTelegramInitData(): string | undefined {
  // Prefer Telegram injected object when available.
  const w = window as any;
  const fromWindow = w?.Telegram?.WebApp?.initData;
  if (typeof fromWindow === 'string' && fromWindow.length > 0) return fromWindow;

  const fromSdk = (WebApp as any)?.initData;
  if (typeof fromSdk === 'string' && fromSdk.length > 0) return fromSdk;

  return undefined;
}

function getTelegramUser(): { username?: string; first_name?: string } | undefined {
  const w = window as any;
  const fromWindow = w?.Telegram?.WebApp?.initDataUnsafe?.user;
  if (fromWindow) return fromWindow as any;

  const fromSdk = (WebApp as any)?.initDataUnsafe?.user;
  if (fromSdk) return fromSdk as any;

  return undefined;
}

function App() {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [balance, setBalance] = useState(0);
  const [daysLeft, setDaysLeft] = useState(0);
  const [planName, setPlanName] = useState('');
  const [username, setUsername] = useState('user');
  const [firstName, setFirstName] = useState('');
  const [configUrl, setConfigUrl] = useState<string | undefined>(undefined);
  // Wallet txs are fetched to keep balance authoritative after purchases/deposits.
  // WalletView will fetch its own list for now; we keep this for future wiring.
  const [, setWalletTxs] = useState<Awaited<ReturnType<typeof getWalletTransactions>>['transactions']>([]);

  // Toast state
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('info');

  // Init Telegram WebApp
  useEffect(() => {
    // Always prefer Telegram injected user data (works even if SDK calls throw).
    const user = getTelegramUser();
    if (user) {
      setUsername(user.username || user.first_name || 'user');
      setFirstName(user.first_name || '');
    }

    // SDK cosmetics (don’t let failures override user state)
    try {
      WebApp.ready();
      WebApp.expand();
      WebApp.setHeaderColor('#0a0a1a');
      WebApp.setBackgroundColor('#0a0a1a');
    } catch {
      // ignore
    }
  }, []);

  // Authenticate + fetch active config (if any)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initData = getTelegramInitData();
        if (initData) {
          const authResp = await telegramAuth(initData);
          // If Telegram user fields are missing for any reason, use backend user.
          if (!cancelled) {
            const tg = getTelegramUser();
            if (!tg) {
              const u = authResp.user?.username;
              if (u) setUsername(u);
            }
          }
        }
      } catch {
        // ok: user may be outside Telegram or backend not ready
      }

      try {
        const w = await getWallet();
        if (!cancelled) setBalance(Number(w.balance ?? 0));
        const txResp = await getWalletTransactions();
        if (!cancelled) setWalletTxs(txResp.transactions);
      } catch {
        // ok
      }

      try {
        const cfg = await getConfig();
        if (cancelled) return;
        setIsSubscribed(true);
        setConfigUrl(cfg.config_url);
        setDaysLeft(daysUntil(cfg.expires_at));
        setPlanName(cfg.plan_type === 'yearly' ? '1 Year' : '1 Month');
      } catch {
        // ok: no active subscription
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  const handleBuyPlan = useCallback(async (planId: string) => {
    const plan = planPrices[planId];
    if (!plan) return;

    if (balance < plan.price) {
      showToast('Insufficient balance. Add funds first!', 'error');
      setActiveTab('wallet');
      return;
    }

    const initData = getTelegramInitData();
    if (!initData) {
      showToast('Open the mini app inside Telegram to subscribe.', 'error');
      return;
    }

    const planType = planId === '1year' ? 'yearly' : 'monthly';
    try {
      showToast('Creating your subscription…', 'info');
      const resp = await subscribe(planType);
      const expiresAt = resp.subscription.expires_at;
      const url = resp.subscription.config_url ?? undefined;

      // Refresh wallet from backend (authoritative).
      try {
        const w = await getWallet();
        setBalance(Number(w.balance ?? 0));
        const txResp = await getWalletTransactions();
        setWalletTxs(txResp.transactions);
      } catch {}
      setIsSubscribed(true);
      setConfigUrl(url);
      setDaysLeft(daysUntil(expiresAt));
      setPlanName(planType === 'yearly' ? '1 Year' : '1 Month');
      showToast(`${plan.name} plan activated!`, 'success');
    } catch (e) {
      showToast((e as Error).message || 'Failed to subscribe', 'error');
    }
  }, [balance, showToast]);

  const handleNavigate = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  // Keep wallet balance fresh when opening the wallet tab.
  useEffect(() => {
    if (activeTab !== 'wallet') return;
    let cancelled = false;
    void getWallet()
      .then((w) => {
        if (!cancelled) setBalance(Number(w.balance ?? 0));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <div className="relative min-h-dvh bg-dark-900 bg-grid">
      {/* Background glow */}
      <div className="fixed inset-0 bg-radial-glow pointer-events-none z-0" />

      {/* Toast */}
      <Toast
        message={toastMessage}
        type={toastType}
        isVisible={toastVisible}
        onClose={() => setToastVisible(false)}
      />

      {/* Main content */}
      <main className="relative z-10 px-4 pt-4 pb-24 max-w-md mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {activeTab === 'home' && (
              <HomeView
                username={username}
                isSubscribed={isSubscribed}
                daysLeft={daysLeft}
                onNavigate={handleNavigate}
              />
            )}
            {activeTab === 'wallet' && (
              <WalletView balance={balance} onShowToast={showToast} />
            )}
            {activeTab === 'config' && (
              <ConfigView
                isSubscribed={isSubscribed}
                configUrl={configUrl}
                onBuyPlan={handleBuyPlan}
                onShowToast={showToast}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileView
                username={username}
                firstName={firstName}
                isSubscribed={isSubscribed}
                daysLeft={daysLeft}
                planName={planName}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}

export default App;
