import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportClientEvent, resetClientEvents } from './client-events';

const RESUME = '01934f6e-7a2b-7c3d-8e4f-000000000001';
const posts: { path: string; init: RequestInit }[] = [];
function stub(status = 202) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    posts.push({ path: new URL(String(input), 'http://localhost').pathname, init });
    return new Response(null, { status });
  }));
}
const settled = () => new Promise(resolve => setTimeout(resolve, 0));
beforeEach(() => { posts.length = 0; resetClientEvents(); document.cookie = 'XSRF-TOKEN=synthetic-csrf'; });
afterEach(() => vi.unstubAllGlobals());

describe('client events (NFR-13, DD-P11-14)', () => {
  it('H01 the body has the contract shape and only the contract properties', async () => {
    stub();
    reportClientEvent('preview_failed', 'font_load', RESUME, '1.0.0');
    await settled();
    expect(posts[0]!.path).toBe('/api/v1/client-events');
    expect(posts[0]!.init.method).toBe('POST');
    const body = JSON.parse(posts[0]!.init.body as string);
    expect(Object.keys(body)).toEqual(['events']);
    expect(Object.keys(body.events[0]).sort()).toEqual(['code', 'engineVersion', 'occurredAt', 'resumeId', 'type']);
    expect(body.events[0]).toMatchObject({ type: 'preview_failed', code: 'font_load', resumeId: RESUME, engineVersion: '1.0.0' });
    expect(new Date(body.events[0].occurredAt).toISOString()).toBe(body.events[0].occurredAt);
  });
  it('H02 one report per kind per page load; a different kind still goes', async () => {
    stub();
    reportClientEvent('preview_failed', 'font_load', RESUME, null);
    reportClientEvent('preview_failed', 'font_load', RESUME, null);
    reportClientEvent('preview_failed', 'layout_error', RESUME, null);
    await settled();
    expect(posts).toHaveLength(2);
  });
  it('H03 a failed report does not reach anyone', async () => {
    stub(500);
    expect(() => reportClientEvent('autosave_failed', 'invalid', RESUME, null)).not.toThrow();
    await settled();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }));
    expect(() => reportClientEvent('autosave_failed', 'other', RESUME, null)).not.toThrow();
    await settled();
  });
  it('H03b a code outside the contract pattern is never sent as is', async () => {
    stub();
    reportClientEvent('autosave_failed', 'Has Spaces and <text>', RESUME, null);
    await settled();
    expect(JSON.parse(posts[0]!.init.body as string).events[0].code).toBe('unknown');
  });
});
