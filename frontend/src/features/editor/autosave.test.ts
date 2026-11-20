import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankResumeDocument } from '../../entities/resume';
import { memoryDraftStore, type DraftRow } from '../../entities/resume/local-data';
import type { ResumeDocument } from '../../entities/resume/operations';
import { ApiError } from '../../shared/api/client';
import { AutosaveQueue, DEBOUNCE_MS, NotIdleError, type ReloadReason, type SaveStatus } from './autosave';

const IDS = { userId: 'user-a', resumeId: 'resume-1', tabId: 'tab-1' };
const problem = (status: number, code: string, retryAfter: string | null = null, errors?: unknown[]) =>
  new ApiError(status, { type: 'about:blank', title: 'x', status, code, traceId: 't', ...(errors ? { errors } : {}) } as never, retryAfter);
const networkDown = () => new TypeError('Failed to fetch');
const base = blankResumeDocument();
const named = (title: string): ResumeDocument => ({ ...base, title });

type Call = { body: string; key: string; version: number };
function harness(options: { online?: boolean } = {}) {
  const writes: Call[] = [];
  const copies: { body: string; key: string }[] = [];
  const answers: ((call: Call) => unknown)[] = [];
  const copyAnswers: (() => unknown)[] = [];
  const statuses: SaveStatus[] = [];
  const reloads: { reason: ReloadReason; copy: unknown }[] = [];
  const acks: number[] = [];
  const warnings: unknown[] = [];
  const events: [string, string][] = [];
  const store = memoryDraftStore();
  const state = { online: options.online ?? true, version: 7, reloadFails: false, nextKey: 0 };
  const queue = new AutosaveQueue({
    ...IDS, store,
    newKey: () => `key-${++state.nextKey}`,
    isOnline: () => state.online,
    transport: {
      write: async (body, key, version) => {
        const call = { body, key, version };
        writes.push(call);
        const answer = answers.shift();
        const result = answer ? answer(call) : undefined;
        if (result instanceof Error) throw result;
        if (result instanceof Promise) return result as never;
        return (result ?? { version: version + 1, warnings: [] }) as never;
      },
      createCopy: async (body, key) => {
        copies.push({ body, key });
        const result = copyAnswers.shift()?.();
        if (result instanceof Error) throw result;
        return { id: 'copy-1', title: 'Mine (conflict copy)' };
      },
    },
    reload: async (reason, copy) => {
      reloads.push({ reason, copy });
      if (state.reloadFails) throw networkDown();
      queue.start(named('latest'), 99);
    },
    onStatus: status => { statuses.push(status); },
    onWarnings: value => { warnings.push(value); },
    onAck: version => { acks.push(version); },
    onClientEvent: (type, code) => { events.push([type, code]); },
  });
  queue.start(named('server'), state.version);
  statuses.length = 0; // The status of opening is not an answer to a write.
  return { queue, writes, copies, answers, copyAnswers, statuses, reloads, acks, warnings, events, store, state, last: () => statuses.at(-1)?.kind };
}
const settle = async (ms = 0) => { await vi.advanceTimersByTimeAsync(ms); };
const flush = () => settle(DEBOUNCE_MS);

beforeEach(() => { vi.useFakeTimers(); vi.spyOn(Math, 'random').mockReturnValue(1); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

describe('autosave queue', () => {
  it('A01 debounces a burst into one write within a second of the last edit', async () => {
    const h = harness();
    h.queue.edit(named('a'));
    await settle(DEBOUNCE_MS - 1);
    h.queue.edit(named('ab'));
    await settle(DEBOUNCE_MS - 1);
    expect(h.writes).toHaveLength(0);
    expect(h.last()).toBe('saving');
    await settle(1);
    expect(DEBOUNCE_MS).toBeLessThanOrEqual(1000);
    expect(h.writes).toHaveLength(1);
    expect(JSON.parse(h.writes[0]!.body).title).toBe('ab');
    expect(h.writes[0]!.version).toBe(7);
    expect(h.last()).toBe('saved');
    expect(h.queue.version).toBe(8);
    expect(h.acks).toEqual([8]);
  });

  it('A02 keeps one write in flight; a coalesced body waits and gets a new key and the new version', async () => {
    const h = harness();
    let release: (value: unknown) => void = () => {};
    h.answers.push(() => new Promise(resolve => { release = resolve; }));
    h.queue.edit(named('a'));
    await flush();
    h.queue.edit(named('b'));
    h.queue.edit(named('c'));
    await flush();
    expect(h.writes).toHaveLength(1);
    expect(h.last()).toBe('saving');
    release({ version: 8, warnings: [] });
    await settle();
    expect(h.writes).toHaveLength(2);
    expect(JSON.parse(h.writes[1]!.body).title).toBe('c');
    expect(h.writes[1]!.key).not.toBe(h.writes[0]!.key);
    expect(h.writes[1]!.version).toBe(8);
    expect(h.last()).toBe('saved');
  });

  it('A03 a network failure shows offline and the retry repeats the same bytes and key', async () => {
    const h = harness();
    h.answers.push(networkDown, networkDown);
    h.queue.edit(named('a'));
    await flush();
    expect(h.last()).toBe('offline');
    await settle(1000);
    await settle(2000);
    expect(h.writes).toHaveLength(3);
    expect(new Set(h.writes.map(call => call.key)).size).toBe(1);
    expect(new Set(h.writes.map(call => call.body)).size).toBe(1);
    expect(h.last()).toBe('saved');
  });

  it('A04 resolves a lost response by replay before any newer body, so no false conflict appears', async () => {
    const h = harness();
    h.answers.push(networkDown);
    h.queue.edit(named('a'));
    await flush();
    h.queue.edit(named('b'));
    await flush();
    await settle(1000);
    expect(h.writes.map(call => JSON.parse(call.body).title)).toEqual(['a', 'a', 'b']);
    expect(h.writes[1]!.key).toBe(h.writes[0]!.key);
    expect(h.writes[2]!.key).not.toBe(h.writes[0]!.key);
    expect(h.writes[2]!.version).toBe(8);
    expect(h.reloads).toEqual([]);
    expect(h.last()).toBe('saved');
  });

  it('A05 while known offline it sends nothing and coalesces; online retries at once', async () => {
    const h = harness({ online: false });
    h.queue.edit(named('a'));
    await flush();
    h.queue.edit(named('b'));
    await flush();
    expect(h.writes).toHaveLength(0);
    expect(h.last()).toBe('offline');
    h.state.online = true;
    h.queue.retryNow();
    await settle();
    expect(h.writes).toHaveLength(1);
    expect(JSON.parse(h.writes[0]!.body).title).toBe('b');
    expect(h.last()).toBe('saved');
  });

  it('A06 5xx shows server unavailable, backs off and honours a longer Retry-After, with the same key', async () => {
    const h = harness();
    h.answers.push(() => problem(503, 'service_unavailable', '10'));
    h.queue.edit(named('a'));
    await flush();
    expect(h.last()).toBe('unavailable');
    await settle(9_999);
    expect(h.writes).toHaveLength(1);
    await settle(1);
    expect(h.writes).toHaveLength(2);
    expect(h.writes[1]!.key).toBe(h.writes[0]!.key);
    expect(h.last()).toBe('saved');
  });

  it.each([[429, 'rate_limited'], [409, 'idempotency_request_in_progress'], [403, 'csrf_token_invalid']])('A07 %s %s retries with the same key', async (status, code) => {
    const h = harness();
    h.answers.push(() => problem(status, code));
    h.queue.edit(named('a'));
    await flush();
    expect(h.statuses.map(s => s.kind)).not.toContain('saved');
    await settle(1000);
    expect(h.writes[1]!.key).toBe(h.writes[0]!.key);
    expect(h.last()).toBe('saved');
  });

  it('H04 a 422 reports one content-free event: the key reuse by its own type, any other by its problem code (ADR-037 §4, DD-P08-07)', async () => {
    const h = harness();
    h.answers.push(() => problem(422, 'idempotency_key_reused'));
    h.queue.edit(named('a'));
    await flush();
    expect(h.events).toEqual([['idempotency_key_reused', 'document_write']]);
    await settle(1000);
    const other = harness();
    other.answers.push(() => problem(422, 'validation_failed', null, [{ location: 'body', pointer: '/title', code: 'resume_text_limit_exceeded' }]));
    other.queue.edit(named('a'));
    await flush();
    expect(other.events).toEqual([['autosave_failed', 'resume_text_limit_exceeded']]);
    expect(JSON.stringify(other.events)).not.toContain('/title');
  });

  it('H05 nothing is reported on a 412, a 400, a 500 or offline', async () => {
    for (const answer of [problem(412, 'version_mismatch'), problem(400, 'validation_failed'), problem(500, 'internal'), networkDown()]) {
      const h = harness();
      h.answers.push(() => answer);
      h.queue.edit(named('a'));
      await flush();
      expect(h.events).toEqual([]);
    }
  });

  it('A08 a 422 is never Saved; the next attempt carries a new key', async () => {
    const h = harness();
    h.answers.push(() => problem(422, 'idempotency_key_reused'));
    h.queue.edit(named('a'));
    await flush();
    expect(h.last()).toBe('not-saved');
    expect(h.queue.unsynced).toBe(true);
    expect(h.statuses.map(s => s.kind)).not.toContain('saved');
    expect(h.store.rows).toHaveLength(1);
    await settle(1000);
    expect(h.writes[1]!.key).not.toBe(h.writes[0]!.key);
    expect(h.writes[1]!.body).toBe(h.writes[0]!.body);
    expect(h.last()).toBe('saved');
  });

  it('A09 a 400 is not retried, reports the pointer, keeps the edits, and the next edit tries again', async () => {
    const h = harness();
    h.answers.push(() => problem(400, 'validation_failed', null, [{ location: 'body', pointer: '/sections/2/title', code: 'too_long' }]));
    h.queue.edit(named('a'));
    await flush();
    expect(h.statuses.at(-1)).toEqual({ kind: 'invalid', pointer: '/sections/2/title', code: 'too_long' });
    await settle(120_000);
    expect(h.writes).toHaveLength(1);
    expect(h.store.rows).toHaveLength(1);
    h.queue.edit(named('b'));
    await flush();
    expect(h.writes).toHaveLength(2);
    expect(h.writes[1]!.key).not.toBe(h.writes[0]!.key);
    expect(h.last()).toBe('saved');
  });

  it('A10 a 401 stops and keeps the attempt with its key in the draft', async () => {
    const h = harness();
    h.answers.push(() => problem(401, 'unauthenticated'));
    h.queue.edit(named('a'));
    await flush();
    expect(h.last()).toBe('session-expired');
    await settle(120_000);
    expect(h.writes).toHaveLength(1);
    expect(h.store.rows[0]!.attempt?.key).toBe(h.writes[0]!.key);
    expect(h.queue.unsynced).toBe(true);
  });

  it('A11 a 412 with unsynced edits creates one conflict copy, then reloads and cleans up', async () => {
    const h = harness();
    h.answers.push(() => problem(412, 'version_mismatch'));
    const mine = named('Mine');
    h.queue.edit(mine);
    await flush();
    expect(h.copies).toHaveLength(1);
    const body = JSON.parse(h.copies[0]!.body);
    expect(body).toMatchObject({ source: 'document', copyPhotoFromResumeId: 'resume-1' });
    expect(body.document.title).toBe('Mine (conflict copy)');
    expect(h.reloads).toEqual([{ reason: 'conflict', copy: { id: 'copy-1', title: 'Mine (conflict copy)' } }]);
    expect(h.store.rows).toEqual([]);
    expect(h.queue.version).toBe(99);
    expect(h.queue.unsynced).toBe(false);
    expect(h.last()).toBe('saved');
    expect(h.writes).toHaveLength(1);
  });

  it('A12 cuts a long conflict-copy title by code points and names an empty title', async () => {
    const h = harness();
    h.answers.push(() => problem(412, 'version_mismatch'));
    h.queue.edit(named('😀'.repeat(150)));
    await flush();
    const title = JSON.parse(h.copies[0]!.body).document.title as string;
    expect(Array.from(title)).toHaveLength(150);
    expect(title.endsWith(' (conflict copy)')).toBe(true);
    const empty = harness();
    empty.answers.push(() => problem(412, 'version_mismatch'));
    empty.queue.edit(named(''));
    await flush();
    expect(JSON.parse(empty.copies[0]!.body).document.title).toBe('Untitled resume (conflict copy)');
  });

  it('A13 a failed copy keeps the edits, retries with the same key and body, and discard needs the choice', async () => {
    const h = harness();
    h.answers.push(() => problem(412, 'version_mismatch'));
    h.copyAnswers.push(() => problem(409, 'limit_reached'), networkDown);
    h.queue.edit(named('Mine'));
    await flush();
    expect(h.statuses.at(-1)).toEqual({ kind: 'conflict-failed', reason: 'limit' });
    expect(h.queue.locked).toBe(true);
    expect(h.store.rows[0]!.document.title).toBe('Mine');
    expect(h.store.rows[0]!.copyAttempt?.key).toBe(h.copies[0]!.key);
    expect(h.reloads).toEqual([]);
    await h.queue.retryCopy();
    expect(h.statuses.at(-1)).toEqual({ kind: 'conflict-failed', reason: 'offline' });
    expect(h.copies[1]).toEqual(h.copies[0]);
    await h.queue.discard();
    expect(h.reloads).toEqual([{ reason: 'conflict', copy: null }]);
    expect(h.store.rows).toEqual([]);
    expect(h.queue.locked).toBe(false);
  });

  it('A14 retrying a copy that succeeded but whose reload failed replays the same key', async () => {
    const h = harness();
    h.answers.push(() => problem(412, 'version_mismatch'));
    h.state.reloadFails = true;
    h.queue.edit(named('Mine'));
    await flush();
    expect(h.last()).toBe('conflict-failed');
    h.state.reloadFails = false;
    await h.queue.retryCopy();
    expect(h.copies).toHaveLength(2);
    expect(h.copies[1]!.key).toBe(h.copies[0]!.key);
    expect(h.last()).toBe('saved');
  });

  it.each([[409, 'resume_trashed', 'trashed'], [404, 'not_found', 'gone']] as const)('A15 %s %s saves a copy, then reloads as %s', async (status, code, reason) => {
    const h = harness();
    h.answers.push(() => problem(status, code));
    h.queue.edit(named('Mine'));
    await flush();
    expect(h.copies).toHaveLength(1);
    expect(h.reloads[0]?.reason).toBe(reason);
  });

  it('A16 writes the draft before sending and removes it when clean', async () => {
    const h = harness();
    let seen: DraftRow | undefined;
    h.answers.push(() => { seen = h.store.rows[0]; return { version: 8, warnings: [] }; });
    h.queue.edit(named('a'));
    await settle();
    expect(h.store.rows[0]).toMatchObject({ ...IDS, baseVersion: 7, attempt: null });
    expect(h.store.rows[0]!.document.title).toBe('a');
    await flush();
    expect(seen?.attempt?.key).toBe(h.writes[0]!.key);
    expect(h.store.rows).toEqual([]);
  });

  it('A17 recovery replays a stored attempt with its key, then sends the newer document', async () => {
    const h = harness();
    const server = named('server');
    const attempt = { body: JSON.stringify(named('attempted')), key: 'old-key', version: 7 };
    h.queue.adopt({ ...IDS, baseVersion: 7, document: named('newest'), attempt, copyAttempt: null, updatedAt: 1 }, server, 7);
    await settle();
    expect(h.writes[0]).toEqual(attempt);
    expect(JSON.parse(h.writes[1]!.body).title).toBe('newest');
    expect(h.writes[1]!.version).toBe(8);
    expect(h.last()).toBe('saved');
  });

  it('A18 recovery on a stale base ends in the conflict flow; a draft equal to the server writes nothing', async () => {
    const h = harness();
    h.answers.push(() => problem(412, 'version_mismatch'));
    h.queue.adopt({ ...IDS, baseVersion: 5, document: named('draft'), attempt: null, copyAttempt: null, updatedAt: 1 }, named('server'), 7);
    await settle();
    expect(h.writes[0]!.version).toBe(5);
    expect(h.copies).toHaveLength(1);
    const same = harness();
    const document = named('same');
    same.queue.adopt({ ...IDS, baseVersion: 7, document, attempt: null, copyAttempt: null, updatedAt: 1 }, document, 7);
    await settle();
    expect(same.writes).toEqual([]);
    expect(same.store.rows).toEqual([]);
    expect(same.last()).toBe('saved');
  });

  it('A19 rescue turns an older orphan into a conflict copy with a stable key', async () => {
    const h = harness();
    const row = { ...IDS, tabId: 'tab-dead', baseVersion: 5, document: named('orphan'), attempt: null, copyAttempt: null, updatedAt: 1 };
    h.store.rows.push(row);
    h.copyAnswers.push(networkDown);
    await h.queue.rescue(row).catch(() => {});
    const key = h.store.rows[0]!.copyAttempt?.key;
    expect(key).toBeTruthy();
    await h.queue.rescue(h.store.rows[0]!);
    expect(h.copies.map(copy => copy.key)).toEqual([key, key]);
    expect(h.store.rows).toEqual([]);
  });

  it('A20 undoing back to the acknowledged document sends nothing and is Saved', async () => {
    const h = harness();
    h.queue.edit(named('a'));
    h.queue.edit(named('server'));
    await flush();
    expect(h.writes).toEqual([]);
    expect(h.queue.unsynced).toBe(false);
    expect(h.last()).toBe('saved');
    expect(h.store.rows).toEqual([]);
  });

  it('A21 runExclusive drains first, uses the current version and stores the new one', async () => {
    const h = harness();
    h.queue.edit(named('a'));
    const versions: number[] = [];
    const result = h.queue.runExclusive(async version => { versions.push(version); return { version: version + 1 }; });
    await settle();
    await result;
    expect(h.writes).toHaveLength(1);
    expect(versions).toEqual([8]);
    expect(h.queue.version).toBe(9);
    h.queue.edit(named('b'));
    await flush();
    expect(h.writes[1]!.version).toBe(9);
  });

  it('A22 runExclusive refuses while it cannot drain, and a 412 from the operation reloads', async () => {
    const offline = harness({ online: false });
    await expect(offline.queue.runExclusive(async version => ({ version }))).rejects.toBeInstanceOf(NotIdleError);
    const h = harness();
    await expect(h.queue.runExclusive(async () => { throw problem(412, 'version_mismatch'); })).rejects.toBeInstanceOf(ApiError);
    await settle();
    expect(h.copies).toEqual([]);
    expect(h.reloads).toEqual([{ reason: 'conflict', copy: null }]);
  });

  it('A23 a newer version from another tab reloads a clean tab and is ignored with unsynced edits', async () => {
    const h = harness();
    h.queue.notifyRemote(7);
    await settle();
    expect(h.reloads).toEqual([]);
    h.queue.notifyRemote(9);
    await settle();
    expect(h.reloads).toEqual([{ reason: 'remote', copy: null }]);
    const dirty = harness();
    dirty.queue.edit(named('a'));
    dirty.queue.notifyRemote(9);
    await settle();
    expect(dirty.reloads).toEqual([]);
  });

  it('A24 passes server warnings on, and dispose stops timers', async () => {
    const h = harness();
    const warning = { pointer: '/sections/0/content/entries/0/end', code: 'date_range_inverted' };
    h.answers.push(() => ({ version: 8, warnings: [warning] }));
    h.queue.edit(named('a'));
    await flush();
    expect(h.warnings.at(-1)).toEqual([warning]);
    h.queue.edit(named('b'));
    h.queue.dispose();
    await flush();
    expect(h.writes).toHaveLength(1);
    expect(h.store.rows).toHaveLength(1);
  });

  it('A25 a queue that never opened anything sends nothing when left', async () => {
    const writes: string[] = [];
    const store = memoryDraftStore();
    const queue = new AutosaveQueue({
      ...IDS, store, newKey: () => 'k', isOnline: () => true,
      transport: { write: async body => { writes.push(body); return { version: 1, warnings: [] }; }, createCopy: async () => ({ id: 'x', title: 'x' }) },
      reload: async () => {}, onStatus: () => {}, onWarnings: () => {}, onAck: () => {},
    });
    expect(queue.unsynced).toBe(false);
    queue.leave();
    await settle(DEBOUNCE_MS);
    expect(writes).toEqual([]);
    expect(store.rows).toEqual([]);
  });

  it('A26 leaving finishes the pending write and then stops', async () => {
    const h = harness();
    h.queue.edit(named('a'));
    h.queue.leave();
    await settle();
    expect(h.writes).toHaveLength(1);
    expect(h.store.rows).toEqual([]);
    expect(h.last()).toBe('saved');
    h.queue.edit(named('b'));
    await flush();
    expect(h.writes).toHaveLength(1);
  });
});
