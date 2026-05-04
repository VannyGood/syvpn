import { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  claimTrial,
  getConfig,
  getMe,
  getToken,
  getWallet,
  getWalletTransactions,
  subscribe,
  telegramAuth,
} from './api/client';

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

function getReferralCodeFromContext(): string | null {
  // 1) URL param for web / deep links
  try {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get('ref');
    if (ref && ref.trim().length > 0) return ref.trim();
  } catch {}

  // 2) Telegram start_param (when opening mini app via /start <payload>)
  try {
    const w = window as any;
    const sp = w?.Telegram?.WebApp?.initDataUnsafe?.start_param ?? (WebApp as any)?.initDataUnsafe?.start_param;
    if (typeof sp === 'string' && sp.trim().length > 0) {
      const raw = sp.trim();
      // We use startapp payloads like: ref_<code>
      if (raw.startsWith('ref_')) return raw.slice(4);
      return raw;
    }
  } catch {}

  // 3) Persisted from earlier open
  try {
    const stored = localStorage.getItem('syvpn_referral_code');
    if (stored && stored.trim().length > 0) return stored.trim();
  } catch {}

  return null;
}

function BrowserLanding() {
  const botUrl = 'https://t.me/SenYuvpn_bot';
  return (
    <div className="relative min-h-dvh bg-dark-900 bg-grid">
      <div className="fixed inset-0 bg-radial-glow pointer-events-none z-0" />
      <main className="relative z-10 px-4 pt-10 pb-10 max-w-md mx-auto">
        <div className="glass rounded-2xl p-6 text-center space-y-4">
          <h1 className="text-2xl font-bold text-white">Welcome to SY VPN</h1>
          <p className="text-sm text-gray-400">
            This app works inside Telegram. Open it from Telegram to continue.
          </p>
          <a
            href={botUrl}
            className="btn-neon-gradient text-white shadow-lg shadow-neon-blue/20 hover:shadow-neon-blue/40 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold w-full"
          >
            Open in Telegram
          </a>
          <p className="text-[11px] text-gray-500">
            If the button doesn’t open Telegram, search for <span className="text-gray-300">@SenYuvpn_bot</span>.
          </p>
        </div>
      </main>
    </div>
  );
}

function App() {
  const isTelegram = Boolean(getTelegramInitData());
  if (!isTelegram) return <BrowserLanding />;

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [balance, setBalance] = useState(0);
  const [daysLeft, setDaysLeft] = useState(0);
  const [planName, setPlanName] = useState('');
  const [planType, setPlanType] = useState<'monthly' | 'yearly' | 'trial' | ''>('');
  const [username, setUsername] = useState('user');
  const [firstName, setFirstName] = useState('');
  const [configUrl, setConfigUrl] = useState<string | undefined>(undefined);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
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

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }, []);

  /** Syncs plan + days left with backend (which pulls expiry from Marzban). */
  const refreshSubscription = useCallback(async () => {
    if (!getToken()) return;
    try {
      const cfg = await getConfig();
      setIsSubscribed(true);
      setConfigUrl(cfg.config_url);
      setDaysLeft(daysUntil(cfg.expires_at));
      setPlanName(cfg.plan_type === 'yearly' ? '1 Year' : cfg.plan_type === 'trial' ? 'Free Trial' : '1 Month');
      setPlanType(cfg.plan_type);
    } catch {
      setIsSubscribed(false);
      setConfigUrl(undefined);
      setDaysLeft(0);
      setPlanName('');
      setPlanType('');
    }
  }, []);

  // Authenticate + wallet + first subscription sync
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const initData = getTelegramInitData();
        if (initData) {
          const ref = getReferralCodeFromContext();
          if (ref) {
            try {
              localStorage.setItem('syvpn_referral_code', ref);
            } catch {}
          }
          const authResp = await telegramAuth(initData, { referralCode: ref });
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
        const me = await getMe();
        if (!cancelled) setTrialAvailable(!me.trial_claimed_at);
        if (!cancelled) setReferralCode(me.referral_code ?? null);
      } catch {
        if (!cancelled) setTrialAvailable(false);
        if (!cancelled) setReferralCode(null);
      }

      await refreshSubscription();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshSubscription]);

  /** Skip first run so we don’t double-fetch on mount (handled in auth effect). */
  const skipTabSubscriptionRefresh = useRef(true);

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
      setPlanType(planType);
      setTrialAvailable(false);
      showToast(`${plan.name} plan activated!`, 'success');
    } catch (e) {
      showToast((e as Error).message || 'Failed to subscribe', 'error');
    }
  }, [balance, showToast]);

  const handleClaimTrial = useCallback(async () => {
    try {
      showToast('Claiming free trial…', 'info');
      const resp = await claimTrial();
      const expiresAt = resp.subscription.expires_at;
      const url = resp.subscription.config_url ?? undefined;
      setIsSubscribed(true);
      setConfigUrl(url);
      setDaysLeft(daysUntil(expiresAt));
      setPlanName('Free Trial');
      setPlanType('trial');
      setTrialAvailable(false);
      showToast('Free trial activated!', 'success');
    } catch (e) {
      showToast((e as Error).message || 'Could not claim trial', 'error');
    }
  }, [showToast]);

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

  // Refetch subscription when visiting Home / Profile / VPN — backend syncs Marzban expiry on GET /config.
  useEffect(() => {
    if (activeTab !== 'home' && activeTab !== 'profile' && activeTab !== 'config') return;
    if (skipTabSubscriptionRefresh.current) {
      skipTabSubscriptionRefresh.current = false;
      return;
    }
    void refreshSubscription();
  }, [activeTab, refreshSubscription]);

  // When returning to the mini app (e.g. after editing Marzban), refresh days remaining.
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      void refreshSubscription();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [refreshSubscription]);

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
                onClaimTrial={handleClaimTrial}
                trialAvailable={trialAvailable}
                isTrial={planType === 'trial'}
                onShowToast={showToast}
                onSubscriptionRefreshed={refreshSubscription}
              />
            )}
            {activeTab === 'profile' && (
              <ProfileView
                username={username}
                firstName={firstName}
                isSubscribed={isSubscribed}
                daysLeft={daysLeft}
                planName={planName}
                referralCode={referralCode}
                onShowToast={showToast}
                onSubscriptionRefreshed={refreshSubscription}
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
