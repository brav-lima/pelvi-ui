import React, { ReactNode } from 'react';
import { useFeature } from '@/contexts/SubscriptionContext';
import type { PlanFeature } from '@/types/clinic';

interface FeatureGateProps {
  feature: PlanFeature;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  const allowed = useFeature(feature);
  if (allowed) return <>{children}</>;
  return <>{fallback}</>;
}
