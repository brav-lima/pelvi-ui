import { describe, it, expect } from 'vitest';
import { initAnalytics, track, identifyUser, resetUser, AnalyticsEvent } from './analytics';

describe('analytics', () => {
  it('all functions are no-ops', () => {
    expect(() => initAnalytics()).not.toThrow();
    expect(() => track(AnalyticsEvent.Login)).not.toThrow();
    expect(() => track(AnalyticsEvent.PatientCreated, { foo: 'bar' })).not.toThrow();
    expect(() =>
      identifyUser('person-1', { role: 'ADMIN', organizationId: 'org-1' }),
    ).not.toThrow();
    expect(() => resetUser()).not.toThrow();
  });
});
