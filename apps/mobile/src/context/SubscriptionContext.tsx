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
  max_active_properties: number | null;
  max_images_per_property: number | null;
  allows_featured: boolean;
  includes_statistics: boolean;
  priority_in_results: boolean;
  publication_duration_days: number | null;
  is_active: boolean;
}

export interface Subscription {
  id: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  subscription_plans: Plan;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  plans: Plan[];
  freeTrialUsed: boolean;
  isActive: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType>({
  subscription: null,
  plans: [],
  freeTrialUsed: true,
  isActive: false,
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

  return (
    <SubscriptionContext.Provider value={{ subscription, plans, freeTrialUsed, isActive, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export const useSubscription = () => useContext(SubscriptionContext);
