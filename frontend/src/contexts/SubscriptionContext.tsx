import React, { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { subscriptionApi } from '@/lib/api';
import { useAuth } from './AuthContext';
import type { PlanFeature, PlanFeatureStatus } from '@/types/clinic';

interface SubscriptionContextType {
  subscription: PlanFeatureStatus | undefined;
  isLoading: boolean;
  hasFeature: (feature: PlanFeature) => boolean;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: () => subscriptionApi.getStatus(),
    enabled: isAuthenticated,
    // Backend já cacheia o snapshot no Redis (TTL 5min), então não precisamos
    // segurar dado velho por muito tempo aqui. Um staleTime curto reduz a janela
    // de UI desatualizada quando o plano muda fora deste app (ex: pelvi-admin),
    // enquanto refetchOnWindowFocus cobre o caso de aba deixada aberta.
    staleTime: 30 * 1000,
    retry: false,
  });

  const hasFeature = (feature: PlanFeature): boolean => {
    if (isLoading) return true;
    return subscription?.features.includes(feature) ?? false;
  };

  return (
    <SubscriptionContext.Provider value={{ subscription, isLoading, hasFeature }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionContextType {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
}

export function useFeature(feature: PlanFeature): boolean {
  const { hasFeature } = useSubscription();
  return hasFeature(feature);
}
