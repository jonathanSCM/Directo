import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currency: string;
  duration_days: number;
  included_properties: number;
  extra_property_price: string;
  allows_featured: boolean;
  includes_statistics: boolean;
  priority_in_results: boolean;
  publication_duration_days: number | null;
  is_business: boolean;
  ad_views: number;
  is_active: boolean;
  includes_sales_agent?: boolean;
  agent_commission_sale_pct?: string | null;
  agent_commission_rent_pct?: string | null;
  agent_commission_anticretico_pct?: string | null;
}

export interface Subscription {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  property_count: number | null;
  subscription_plans: Plan;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  plans: Plan[];
  freeTrialUsed: boolean;
  isActive: boolean;
  /** Suscripción activa y es el plan gratis (price === 0) — todavía no pagó nunca. */
  isFreePlanActive: boolean;
  /** Días restantes de la suscripción activa (redondeado hacia arriba), o null si no hay `end_date`. */
  daysLeft: number | null;
  /** Plan gratis del catálogo (para su duración real, precios de referencia, etc). */
  freePlan: Plan | null;
  /** Plan pago más barato del catálogo, para mostrar "desde $X" en las promos. */
  cheapestPaidPlan: Plan | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  plans: [],
  freeTrialUsed: true,
  isActive: false,
  isFreePlanActive: false,
  daysLeft: null,
  freePlan: null,
  cheapestPaidPlan: null,
  loading: true,
  refresh: async () => {},
});

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const isOwner = user?.active_role === 'owner';
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [freeTrialUsed, setFreeTrialUsed] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isAuthenticated || !isOwner) {
      setSubscription(null);
      setPlans([]);
      setLoading(false);
      return;
    }
    try {
      const [subRes, plansRes, trialRes] = await Promise.all([
        api.get('/subscriptions/me').catch(() => ({ data: null })),
        api.get('/subscription-plans'),
        api.get('/subscriptions/free-trial/status').catch(() => ({ data: { used: true } })),
      ]);
      setSubscription(subRes.data);
      setPlans(plansRes.data);
      setFreeTrialUsed(trialRes.data.used);
    } catch {}
    setLoading(false);
  }, [isAuthenticated, isOwner]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  const isActive = subscription?.status === 'active';
  const isFreePlanActive = isActive && Number(subscription?.subscription_plans?.price ?? -1) === 0;
  const daysLeft = subscription?.end_date
    ? Math.max(0, Math.ceil((new Date(subscription.end_date).getTime() - Date.now()) / 86_400_000))
    : null;
  const freePlan = plans.find((p) => Number(p.price) === 0) ?? null;
  const cheapestPaidPlan = plans
    .filter((p) => Number(p.price) > 0)
    .reduce<Plan | null>((min, p) => (!min || Number(p.price) < Number(min.price) ? p : min), null);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        plans,
        freeTrialUsed,
        isActive,
        isFreePlanActive,
        daysLeft,
        freePlan,
        cheapestPaidPlan,
        loading,
        refresh,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
