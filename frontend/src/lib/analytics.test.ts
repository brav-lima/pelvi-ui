import { vi, beforeEach, describe, it, expect } from 'vitest';

const posthogMock = {
  init: vi.fn(),
  capture: vi.fn(),
  identify: vi.fn(),
  group: vi.fn(),
  reset: vi.fn(),
};

vi.mock('posthog-js', () => ({ default: posthogMock }));

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it('does not call posthog.init when VITE_POSTHOG_KEY is not set', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { initAnalytics } = await import('./analytics');
    initAnalytics();
    expect(posthogMock.init).not.toHaveBeenCalled();
  });

  it('calls posthog.init with the expected config when VITE_POSTHOG_KEY is set', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics } = await import('./analytics');
    initAnalytics();
    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: true,
        autocapture: false,
        disable_session_recording: true,
      }),
    );
  });

  it('falls back to the default api_host when VITE_POSTHOG_HOST is an empty string', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    vi.stubEnv('VITE_POSTHOG_HOST', '');
    const { initAnalytics } = await import('./analytics');
    initAnalytics();
    expect(posthogMock.init).toHaveBeenCalledWith(
      'phc_test_key',
      expect.objectContaining({ api_host: 'https://us.i.posthog.com' }),
    );
  });

  it('track() is a no-op before initAnalytics() runs', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { track, AnalyticsEvent } = await import('./analytics');
    track(AnalyticsEvent.Login);
    expect(posthogMock.capture).not.toHaveBeenCalled();
  });

  it('track() calls posthog.capture with the event and properties after init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics, track, AnalyticsEvent } = await import('./analytics');
    initAnalytics();
    track(AnalyticsEvent.PatientCreated, { foo: 'bar' });
    expect(posthogMock.capture).toHaveBeenCalledWith('patient_created', { foo: 'bar' });
  });

  it('identifyUser() calls posthog.identify and posthog.group after init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics, identifyUser } = await import('./analytics');
    initAnalytics();
    identifyUser('person-1', { role: 'ADMIN', organizationId: 'org-1' });
    expect(posthogMock.identify).toHaveBeenCalledWith('person-1', { role: 'ADMIN' });
    expect(posthogMock.group).toHaveBeenCalledWith('organization', 'org-1');
  });

  it('identifyUser() is a no-op before initAnalytics() runs', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '');
    const { identifyUser } = await import('./analytics');
    identifyUser('person-1', { role: 'ADMIN', organizationId: 'org-1' });
    expect(posthogMock.identify).not.toHaveBeenCalled();
  });

  it('resetUser() calls posthog.reset after init', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test_key');
    const { initAnalytics, resetUser } = await import('./analytics');
    initAnalytics();
    resetUser();
    expect(posthogMock.reset).toHaveBeenCalled();
  });
});
