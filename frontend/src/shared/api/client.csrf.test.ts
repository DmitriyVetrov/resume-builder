import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiResource } from './client';

/**
 * The cold-start 403 of P10 (AC-P13-13). The client reads the CSRF header from `document.cookie` before `fetch`, so a
 * bootstrap answer that lands later replaces the cookie pair under a mutation already sent with the old header.
 */
const clearCookie = () => { document.cookie = 'XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT'; };
const cookie = () => document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('XSRF-TOKEN='))?.slice(11) ?? null;
const forbidden = () => new Response(JSON.stringify({ type: 'about:blank', title: 'Forbidden', status: 403, code: 'csrf_token_invalid', traceId: 't' }), { status: 403, headers: { 'Content-Type': 'application/problem+json' } });
const created = () => new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } });

type Seen = { method: string; path: string; header: string | null };
let seen: Seen[] = [];

beforeEach(() => { seen = []; clearCookie(); });
afterEach(() => { vi.unstubAllGlobals(); clearCookie(); });

function server(mutation: (attempt: number, header: string | null) => Response, bootstrapDelay = 0) {
  let sessions = 0;
  let attempts = 0;
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const path = new URL(String(input), 'http://localhost').pathname;
    const method = (init.method ?? 'GET').toUpperCase();
    const header = new Headers(init.headers).get('X-XSRF-TOKEN');
    seen.push({ method, path, header });
    if (path === '/api/v1/session') {
      sessions++;
      if (bootstrapDelay) await new Promise(done => setTimeout(done, bootstrapDelay));
      if (!cookie()) document.cookie = `XSRF-TOKEN=pair-${sessions}`;
      return new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    attempts++;
    return mutation(attempts, header);
  }));
}

describe('CSRF bootstrap and retry (DD-P13-17)', () => {
  it('C01 a pair replaced under an in-flight mutation is recovered by one retry with the current pair', async () => {
    server((attempt, header) => {
      if (attempt === 1) {
        // The slower bootstrap answer arrives now and installs another pair.
        document.cookie = 'XSRF-TOKEN=pair-late';
        return forbidden();
      }
      return header === cookie() ? created() : forbidden();
    });
    await expect(apiResource('/auth/sign-up', { method: 'POST', body: '{}' })).resolves.toEqual({ ok: true });
    const mutations = seen.filter(call => call.method === 'POST');
    expect(mutations.map(call => call.header)).toEqual(['pair-1', 'pair-late']);
  });

  it('C02 concurrent first mutations share one bootstrap', async () => {
    server(() => created(), 5);
    await Promise.all([
      apiResource('/auth/login', { method: 'POST', body: '{}' }),
      apiResource('/auth/sign-up', { method: 'POST', body: '{}' }),
    ]);
    expect(seen.filter(call => call.path === '/api/v1/session')).toHaveLength(1);
  });

  it('C03 a second rejection reaches the caller after exactly two attempts', async () => {
    document.cookie = 'XSRF-TOKEN=pair-0';
    server(() => forbidden());
    const failure = await apiResource('/auth/login', { method: 'POST', body: '{}' }).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).problem?.code).toBe('csrf_token_invalid');
    expect(seen.filter(call => call.method === 'POST')).toHaveLength(2);
  });
});
