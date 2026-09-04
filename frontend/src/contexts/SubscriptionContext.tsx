import React, { createContext, useContext, useMemo, ReactNode } from 'react';
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

// Last-known feature snapshot, persisted per organization. Seeding the query
// with it means `isLoading` is never true on a reload, so the sidebar / feature
// gates render the real plan immediately instead of briefly failing open (menu
// items appearing then disappearing once the response lands). Revalidated in
// the background — see staleTime below. Not a security boundary: every
// @RequireFeature route revalidates on the backend on each real call.
const SNAPSHOT_KEY = 'pelvi:subscription-snapshot';

interface PersistedSnapshot {
  orgId: string;
  updatedAt: number;
  data: PlanFeatureStatus;
}

function readSnapshot(orgId: string | undefined): PersistedSnapshot | null {
  if (!orgId) return null;
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSnapshot;
    if (parsed?.orgId !== orgId || !Array.isArray(parsed?.data?.features)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSnapshot(orgId: string, data: PlanFeatureStatus): void {
  try {
    const snapshot: PersistedSnapshot = { orgId, updatedAt: Date.now(), data };
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    /* localStorage unavailable — fall back to fetch-only */
  }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, selectedClinic } = useAuth();
  const orgId = selectedClinic?.id;
  const snapshot = useMemo(() => readSnapshot(orgId), [orgId]);

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscription', 'status'],
    queryFn: async () => {
      const data = await subscriptionApi.getStatus();
      if (orgId) writeSnapshot(orgId, data);
      return data;
    },
    enabled: isAuthenticated,
    // Backend already caches the snapshot in Redis (TTL 5min), so there is no
    // point holding stale data long here. A short staleTime narrows the
    // out-of-date window when the plan changes outside this app (e.g.
    // pelvi-admin); refetchOnWindowFocus covers the idle-tab case.
    staleTime: 30 * 1000,
    retry: false,
    initialData: snapshot?.data,
    initialDataUpdatedAt: snapshot?.updatedAt,
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
