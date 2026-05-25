import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import BillingCards from '../components/BillingCards';
import BillingPromo from '../components/BillingPromo';
import BillingUsage from '../components/BillingUsage';
import CheckoutModal from '../components/CheckoutModal';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { btnGesture } from '../styles/gestures';
import { PLANS } from '../components/BillingCards';
import { billingApi } from '../lib/api/billing';
import { usersApi } from '../lib/api/users';
import { ApiError } from '../lib/api-errors';
import { sanitizePromo } from '../lib/billing';

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: { Url: { Open: (url: string) => void } };
  }
}

function loadLemonSqueezy() {
  if (document.getElementById('ls-script')) return;
  const s = document.createElement('script');
  s.id = 'ls-script';
  s.src = 'https://app.lemonsqueezy.com/js/lemon.js';
  s.defer = true;
  s.onload = () => window.createLemonSqueezy?.();
  document.head.appendChild(s);
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function BillingPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentPlan, setCurrentPlan] = useState('free');
  const [usage, setUsage] = useState({ ai_usage: 0, ai_limit: 0 });
  const [loading, setLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [confirmPlan, setConfirmPlan] = useState<string | null>(null);
  const upgradePlan = searchParams.get('upgrade');

  useEffect(() => {
    loadLemonSqueezy();
    if (searchParams.get('success') === '1') {
      toast({ type: 'success', title: 'Payment successful', message: 'Your plan has been upgraded.' });
      searchParams.delete('success');
      setSearchParams(searchParams, { replace: true });
    }
    if (!token) return;
    let cancelled = false;
    usersApi
      .me()
      .then((data) => {
        if (cancelled) return;
        if (data.plan) setCurrentPlan(data.plan);
        if (data.ai_usage !== undefined) {
          setUsage({ ai_usage: data.ai_usage, ai_limit: data.ai_limit ?? 0 });
        }
      })
      .catch((err) => {
        if (cancelled || err?.name === 'AuthExpiredError') return;
        toast({
          type: 'warning',
          title: 'Could not load billing info',
          message: err instanceof Error ? err.message : 'Refresh to try again.',
        });
      });
    return () => { cancelled = true; };
  }, [token]);

  const handlePromoChange = useCallback((value: string) => {
    setPromoCode(sanitizePromo(value));
  }, []);

  async function handleConfirmedCheckout(planId: string, code: string) {
    if (!token || loading) return;
    setLoading(planId);
    setConfirmPlan(null);
    try {
      const body = code.trim()
        ? { plan: planId, discount_code: code.trim() }
        : { plan: planId };
      const data = await billingApi.checkout(body);
      if (data.url && window.LemonSqueezy) {
        window.LemonSqueezy.Url.Open(data.url);
      } else if (data.url) {
        openExternal(data.url);
      } else {
        toast({
          type: 'error',
          title: 'Checkout unavailable',
          message: 'No checkout URL was returned. Please try again in a moment.',
        });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        toast({ type: 'warning', title: 'Slow down', message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast({ type: 'error', title: 'Checkout failed', message });
    } finally {
      setLoading(null);
    }
  }

  async function handlePortal() {
    if (!token || portalLoading) return;
    setPortalLoading(true);
    try {
      const data = await billingApi.portal();
      if (data.url) openExternal(data.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Please try again.';
      toast({ type: 'error', title: 'Customer portal unavailable', message });
    } finally {
      setPortalLoading(false);
    }
  }

  const confirmPlanData = confirmPlan ? PLANS.find((p) => p.id === confirmPlan) ?? null : null;
  const isPending = Boolean(loading);

  return (
    <div>
      <PageHeader title="Billing" description="Manage your subscription and usage" />
      <BillingPromo promoCode={promoCode} onPromoChange={handlePromoChange} />
      <BillingCards
        currentPlan={currentPlan}
        loading={loading}
        upgradePlan={upgradePlan}
        onCheckout={(planId) => !isPending && setConfirmPlan(planId)}
      />
      <BillingUsage aiUsage={usage.ai_usage} aiLimit={usage.ai_limit} />
      {currentPlan !== 'free' && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
            Manage Subscription
          </h2>
          <button
            type="button"
            onClick={handlePortal}
            disabled={portalLoading}
            className={`px-4 py-2 rounded-lg border border-zinc-700/80 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 text-sm disabled:opacity-60 disabled:cursor-not-allowed ${btnGesture}`}
          >
            {portalLoading ? 'Opening portal…' : 'Manage in Customer Portal'}
          </button>
        </section>
      )}
      {confirmPlanData && (
        <CheckoutModal
          plan={confirmPlanData}
          promoCode={promoCode}
          onPromoChange={handlePromoChange}
          onConfirm={(code) => handleConfirmedCheckout(confirmPlanData.id, code)}
          onClose={() => setConfirmPlan(null)}
          pending={loading === confirmPlanData.id}
        />
      )}
    </div>
  );
}
