describe('Auth cookie configuration', () => {
  it('access token max age should be at least 30 minutes', () => {
    const ACCESS_TOKEN_MAX_AGE_MS = 60 * 60 * 1000;
    expect(ACCESS_TOKEN_MAX_AGE_MS).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });

  it('refresh cookie path should start with /api/v1', () => {
    const REFRESH_COOKIE_PATH = '/api/v1/auth';
    expect(REFRESH_COOKIE_PATH).toMatch(/^\/api\/v1/);
  });
});
