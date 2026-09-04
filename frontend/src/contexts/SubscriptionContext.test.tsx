import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('@/lib/api', () => ({
  subscriptionApi: { getStatus: vi.fn() },
}));

import { useAuth } from '@/contexts/AuthContext';
import { subscriptionApi } from '@/lib/api';
import { SubscriptionProvider, useFeature } from './SubscriptionContext';
import type { PlanFeature, PlanFeatureStatus } from '@/types/clinic';

const SNAPSHOT_KEY = 'pelvi:subscription-snapshot';

function statusWith(features: PlanFeature[]): PlanFeatureStatus {
  return {
    plan: 'origem',
    planStatus: 'ACTIVE',
    isActive: true,
    isTrialExpired: false,
    daysLeftInTrial: null,
    founderDiscount: false,
    features,
  };
}

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>{children}</SubscriptionProvider>
      </QueryClientProvider>
    );
  };
}

function FeatureProbe({ feature }: { feature: PlanFeature }) {
  const allowed = useFeature(feature);
  return <span data-testid="allowed">{String(allowed)}</span>;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.mocked(useAuth).mockReturnValue({ isAuthenticated: true, selectedClinic: { id: 'org-1' } } as any);
});

describe('SubscriptionContext — persisted snapshot', () => {
  it('seeds from a matching-org snapshot so gated items do NOT flash on first render', () => {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ orgId: 'org-1', updatedAt: Date.now(), data: statusWith(['AGENDA']) }),
    );
    // Query would resolve to the same thing, but we assert the FIRST paint.
    vi.mocked(subscriptionApi.getStatus).mockResolvedValue(statusWith(['AGENDA']));

    render(<FeatureProbe feature="DOCUMENTS" />, { wrapper: makeWrapper() });

    // Without the snapshot seed this would be "true" (fail-open while loading).
    expect(screen.getByTestId('allowed')).toHaveTextContent('false');
  });

  it('ignores a snapshot stored for a different org', () => {
    localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ orgId: 'other-org', updatedAt: Date.now(), data: statusWith(['AGENDA']) }),
    );
    vi.mocked(subscriptionApi.getStatus).mockResolvedValue(statusWith(['AGENDA']));

    render(<FeatureProbe feature="DOCUMENTS" />, { wrapper: makeWrapper() });

    // No usable snapshot → fail-open while the query is in flight.
    expect(screen.getByTestId('allowed')).toHaveTextContent('true');
  });

  it('persists the snapshot for the current org after the query resolves', async () => {
    vi.mocked(subscriptionApi.getStatus).mockResolvedValue(statusWith(['AGENDA', 'PATIENTS']));

    render(<FeatureProbe feature="PATIENTS" />, { wrapper: makeWrapper() });

    await waitFor(() => {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw as string);
      expect(parsed.orgId).toBe('org-1');
      expect(parsed.data.features).toEqual(['AGENDA', 'PATIENTS']);
    });
  });

  it('still fails open while loading when there is no snapshot', () => {
    vi.mocked(subscriptionApi.getStatus).mockResolvedValue(statusWith(['AGENDA']));

    render(<FeatureProbe feature="DOCUMENTS" />, { wrapper: makeWrapper() });

    expect(screen.getByTestId('allowed')).toHaveTextContent('true');
  });
});
