import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { professionalsApi, API_BASE_URL } from './api';

/**
 * Regression for SOU-22: `queryFn: professionalsApi.list` (bare reference) makes
 * React Query invoke it with a QueryFunctionContext ({ client, queryKey, signal,
 * meta }). Those must never end up as query-string params — the backend rejects
 * unknown properties with a 400.
 */
describe('professionalsApi.list — query param hygiene', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function calledUrl(): string {
    return String(fetchMock.mock.calls[0][0]);
  }

  it('ignores a React Query QueryFunctionContext passed as the first arg', async () => {
    const context = {
      client: {},
      queryKey: ['professionals'],
      signal: new AbortController().signal,
      meta: undefined,
    };

    await professionalsApi.list(context as never);

    const url = calledUrl();
    expect(url).toBe(`${API_BASE_URL}/api/v1/professionals?`);
    expect(url).not.toContain('client');
    expect(url).not.toContain('queryKey');
    expect(url).not.toContain('signal');
  });

  it('still forwards a real search param', async () => {
    await professionalsApi.list({ search: 'ana' });
    expect(calledUrl()).toBe(`${API_BASE_URL}/api/v1/professionals?search=ana`);
  });
});
