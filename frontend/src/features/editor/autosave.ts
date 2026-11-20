import type { ResumeDocument } from '../../entities/resume/operations';
import { onLocalDataRemoved, type CopyAttempt, type DraftRow, type DraftStore, type WriteAttempt } from '../../entities/resume/local-data';
import { ApiError } from '../../shared/api/client';
import type { components } from '../../shared/api/generated/schema';

export type Warning = components['schemas']['ValidationWarning'];
export type SaveStatus =
  | { kind: 'saved' } | { kind: 'saving' } | { kind: 'offline' } | { kind: 'unavailable' } | { kind: 'not-saved' }
  | { kind: 'invalid'; pointer: string | null; code: string | null } | { kind: 'session-expired' }
  | { kind: 'conflict-saving' } | { kind: 'conflict-failed'; reason: 'limit' | 'offline' | 'other' };
export type ReloadReason = 'conflict' | 'trashed' | 'gone' | 'remote';
export type ConflictCopy = { id: string; title: string };
export const DEBOUNCE_MS = 750;
const BACKOFF_START_MS = 1000;
const BACKOFF_MAX_MS = 30_000;
const COPY_SUFFIX = ' (conflict copy)';
const TITLE_LIMIT = 150;

export interface SaveTransport {
  write(body: string, key: string, version: number): Promise<{ version: number; warnings: Warning[] }>;
  createCopy(body: string, key: string): Promise<ConflictCopy>;
}
export type QueueDeps = {
  userId: string; resumeId: string; tabId: string; transport: SaveTransport; store: DraftStore;
  newKey: () => string; isOnline: () => boolean;
  /** Loads the latest server state and calls `start` with it. Rejects if it could not. */
  reload: (reason: ReloadReason, copy: ConflictCopy | null) => Promise<void>;
  onStatus: (status: SaveStatus) => void; onWarnings: (warnings: Warning[]) => void; onAck: (version: number) => void; onClientEvent?: (type: 'idempotency_key_reused' | 'autosave_failed', code: string) => void;
};
export class NotIdleError extends Error {}

function conflictTitle(title: string) {
  const room = TITLE_LIMIT - COPY_SUFFIX.length;
  return Array.from(title || 'Untitled resume').slice(0, room).join('') + COPY_SUFFIX;
}

const codeOf = (error: unknown) => error instanceof ApiError ? error.problem?.code : undefined;

/**
 * The one write path of a resume in a tab (ADR-037 §4). One attempt at a time; an attempt whose outcome is unknown
 * is resolved by replay before any newer body is sent (DD-P08-04). All I/O is injected.
 */
export class AutosaveQueue {
  private local: ResumeDocument | null = null;
  private acked = '';
  private currentVersion = 0;
  private attempt: WriteAttempt | null = null;
  private copyAttempt: CopyAttempt | null = null;
  private conflict: ReloadReason | null = null;
  private status: SaveStatus = { kind: 'saved' };
  private sending = false;
  private exclusive = false;
  private stopped = false;
  private halted = false;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private idleWaiters: { resolve: () => void; reject: (error: Error) => void }[] = [];
  private persisting: Promise<void> | null = null;
  private persistAgain = false;
  private leaving = false;

  private readonly stopListening: () => void;

  constructor(private readonly deps: QueueDeps) {
    // After the user removes local data at sign-out, nothing may write a draft back, including a queue left running.
    this.stopListening = onLocalDataRemoved(userId => { if (userId === deps.userId) this.dispose(); });
  }

  get version() { return this.currentVersion; }
  get unsynced() { return this.local !== null && (this.attempt !== null || this.copyAttempt !== null || JSON.stringify(this.local) !== this.acked); }
  get locked() { return this.conflict !== null; }

  /** A clean state from the server. */
  start(document: ResumeDocument, version: number) {
    this.clearTimers();
    this.local = document;
    this.acked = JSON.stringify(document);
    this.currentVersion = version;
    this.attempt = null;
    this.copyAttempt = null;
    this.conflict = null;
    this.halted = false;
    this.failures = 0;
    this.setStatus({ kind: 'saved' });
  }

  /** Recovery of a draft left by a dead tab or a reload of this one. */
  adopt(row: DraftRow, serverDocument: ResumeDocument, serverVersion: number) {
    this.clearTimers();
    this.local = row.document;
    this.acked = row.baseVersion === serverVersion ? JSON.stringify(serverDocument) : '';
    this.currentVersion = row.baseVersion;
    this.attempt = row.attempt;
    this.copyAttempt = row.copyAttempt;
    this.halted = false;
    if (this.copyAttempt) { void this.resolveConflict('conflict'); return; }
    this.setStatus({ kind: 'saving' });
    void this.persist();
    this.pump();
  }

  edit(document: ResumeDocument) {
    if (this.stopped || this.locked) return;
    this.local = document;
    void this.persist();
    if (this.status.kind === 'saved' || this.status.kind === 'invalid' || this.status.kind === 'not-saved') this.setStatus({ kind: 'saving' });
    if (this.status.kind === 'session-expired') return;
    clearTimeout(this.debounce);
    this.debounce = setTimeout(() => { this.debounce = undefined; this.pump(); }, DEBOUNCE_MS);
  }

  retryNow() {
    if (this.stopped || this.locked || this.status.kind === 'session-expired') return;
    clearTimeout(this.retry);
    this.retry = undefined;
    this.pump();
  }

  retryCopy() { return this.resolveConflict(this.conflict ?? 'conflict'); }

  /** The user's explicit choice to drop unsynced edits (ADR-029 §4). */
  async discard() {
    this.copyAttempt = null;
    this.attempt = null;
    const reason = this.conflict ?? 'conflict';
    if (this.acked) this.local = JSON.parse(this.acked) as ResumeDocument;
    await this.finishConflict(reason, null);
  }

  notifyRemote(version: number) {
    if (version <= this.currentVersion || this.unsynced || this.sending || this.exclusive || this.locked || this.stopped) return;
    void this.deps.reload('remote', null).catch(() => { /* The next write or visit finds the newer version. */ });
  }

  async runExclusive<T extends { version: number }>(operation: (version: number) => Promise<T>): Promise<T> {
    await this.drain();
    this.exclusive = true;
    try {
      const result = await operation(this.currentVersion);
      this.currentVersion = result.version;
      this.deps.onAck(result.version);
      return result;
    } catch (error) {
      if (codeOf(error) === 'version_mismatch') void this.resolveConflict('conflict');
      throw error;
    } finally {
      this.exclusive = false;
      if (!this.locked && this.debounce === undefined && JSON.stringify(this.local) !== this.acked) this.pump();
    }
  }

  /** An orphan draft becomes a conflict copy under a key that survives a retry. */
  async rescue(row: DraftRow, withPhoto = true): Promise<ConflictCopy> {
    const copyAttempt = row.copyAttempt ?? this.buildCopy(row.document, withPhoto);
    if (!row.copyAttempt) await this.deps.store.put({ ...row, copyAttempt }).catch(() => {});
    const copy = await this.deps.transport.createCopy(copyAttempt.body, copyAttempt.key);
    await this.deps.store.remove(row.userId, row.resumeId, row.tabId);
    return copy;
  }

  dispose() {
    this.stopped = true;
    this.stopListening();
    this.clearTimers();
    for (const waiter of this.idleWaiters.splice(0)) waiter.reject(new NotIdleError());
  }

  /** The editor was left: finish what is pending in the background, then stop. The draft covers a closed tab. */
  leave() {
    this.leaving = true;
    if (!this.unsynced && !this.sending) { this.dispose(); return; }
    this.flush();
  }

  /** Sends what is pending now. */
  flush() {
    if (this.stopped || this.locked || this.status.kind === 'session-expired') return;
    clearTimeout(this.debounce);
    this.debounce = undefined;
    this.pump();
  }

  private clearTimers() {
    clearTimeout(this.debounce);
    clearTimeout(this.retry);
    this.debounce = undefined;
    this.retry = undefined;
  }

  private setStatus(status: SaveStatus) {
    this.status = status;
    this.deps.onStatus(status);
  }

  private drain(): Promise<void> {
    if (!this.deps.isOnline()) return Promise.reject(new NotIdleError());
    if (this.locked || this.status.kind === 'session-expired') return Promise.reject(new NotIdleError());
    if (!this.unsynced && !this.sending) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.idleWaiters.push({ resolve, reject });
      this.flush();
    });
  }

  private settleWaiters(ok: boolean) {
    for (const waiter of this.idleWaiters.splice(0)) {
      if (ok) waiter.resolve();
      else waiter.reject(new NotIdleError());
    }
  }

  private pump() {
    if (this.sending || this.exclusive || this.stopped || this.locked || this.local === null) return;
    if (!this.attempt) {
      const body = JSON.stringify(this.local);
      if (body === this.acked) { this.becomeClean(); return; }
      if (!this.deps.isOnline()) { this.waitForNetwork(); return; }
      this.attempt = { body, key: this.deps.newKey(), version: this.currentVersion };
    } else if (!this.deps.isOnline()) { this.waitForNetwork(); return; }
    const attempt = this.attempt;
    this.sending = true;
    void this.persist().then(() => {
      if (this.stopped) throw new NotIdleError();
      return this.deps.transport.write(attempt.body, attempt.key, attempt.version);
    }).then(
      result => { this.sending = false; if (!this.stopped) this.onAcknowledged(attempt, result); },
      error => { this.sending = false; if (!this.stopped) this.onFailed(error); },
    );
  }

  private waitForNetwork() {
    this.setStatus({ kind: 'offline' });
    this.settleWaiters(false);
    this.scheduleRetry(null);
  }

  private onAcknowledged(attempt: WriteAttempt, result: { version: number; warnings: Warning[] }) {
    this.currentVersion = result.version;
    this.acked = attempt.body;
    this.attempt = null;
    this.failures = 0;
    clearTimeout(this.retry);
    this.retry = undefined;
    this.deps.onAck(result.version);
    this.deps.onWarnings(result.warnings);
    if (JSON.stringify(this.local) === this.acked) { this.becomeClean(); return; }
    void this.persist();
    this.setStatus({ kind: 'saving' });
    if (this.debounce === undefined) this.pump();
  }

  private becomeClean() {
    clearTimeout(this.retry);
    this.retry = undefined;
    this.removeDraft();
    this.setStatus({ kind: 'saved' });
    this.settleWaiters(true);
    if (this.leaving) this.dispose();
  }

  private onFailed(error: unknown) {
    if (!(error instanceof ApiError)) {
      this.setStatus({ kind: 'offline' });
      this.settleWaiters(false);
      this.scheduleRetry(null);
      return;
    }
    switch (error.problem?.code) {
      case 'version_mismatch': void this.resolveConflict('conflict'); return;
      case 'resume_trashed': void this.resolveConflict('trashed'); return;
      case 'not_found': void this.resolveConflict('gone'); return;
      case 'idempotency_key_reused':
        // A client defect (ADR-037 §4): never "Saved", and the next attempt carries a new key.
        this.deps.onClientEvent?.('idempotency_key_reused', 'document_write');
        this.attempt = null;
        this.setStatus({ kind: 'not-saved' });
        this.settleWaiters(false);
        this.scheduleRetry(null);
        return;
      case 'csrf_token_invalid':
      case 'idempotency_request_in_progress':
        this.setStatus({ kind: 'saving' });
        this.scheduleRetry(error.retryAfter);
        return;
    }
    if (error.status === 401) { this.setStatus({ kind: 'session-expired' }); this.settleWaiters(false); return; }
    if (error.status === 429 || error.status >= 500) {
      this.setStatus({ kind: 'unavailable' });
      this.settleWaiters(false);
      this.scheduleRetry(error.retryAfter);
      return;
    }
    // R-8: refused as it stands. Not retried; the edits stay, and the next edit tries again with a new key.
    this.attempt = null;
    const issue = error.problem?.errors?.[0];
    if (error.status === 422) this.deps.onClientEvent?.('autosave_failed', issue?.code ?? error.problem?.code ?? 'unknown');
    this.setStatus({ kind: 'invalid', pointer: issue?.pointer ?? null, code: issue?.code ?? error.problem?.code ?? null });
    this.settleWaiters(false);
  }

  private scheduleRetry(retryAfter: string | null) {
    const base = Math.min(BACKOFF_MAX_MS, BACKOFF_START_MS * 2 ** this.failures);
    this.failures++;
    const jittered = base / 2 + Math.random() * base / 2;
    const told = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : 0;
    clearTimeout(this.retry);
    this.retry = setTimeout(() => { this.retry = undefined; this.pump(); }, Math.max(jittered, told));
  }

  private buildCopy(document: ResumeDocument, withPhoto = true): CopyAttempt {
    return {
      key: this.deps.newKey(),
      body: JSON.stringify({ source: 'document', document: { ...document, title: conflictTitle(document.title) }, copyPhotoFromResumeId: withPhoto ? this.deps.resumeId : null }),
    };
  }

  /** ADR-029: keep unsynced edits as a copy under one key, then show the latest. Nothing is dropped without the user's choice. */
  private async resolveConflict(reason: ReloadReason) {
    this.clearTimers();
    this.conflict = reason;
    let copy: ConflictCopy | null = null;
    this.settleWaiters(false);
    const hasEdits = this.copyAttempt !== null || this.attempt !== null || JSON.stringify(this.local) !== this.acked;
    if (hasEdits) {
      this.setStatus({ kind: 'conflict-saving' });
      this.copyAttempt ??= this.buildCopy(this.local as ResumeDocument, reason !== 'gone');
      await this.persist();
      try {
        copy = await this.deps.transport.createCopy(this.copyAttempt.body, this.copyAttempt.key);
      } catch (error) {
        // The source resume went away too, so its photo cannot be copied: try again without it.
        if (codeOf(error) === 'not_found') this.copyAttempt = this.buildCopy(this.local as ResumeDocument, false);
        const limit = codeOf(error) === 'limit_reached';
        this.setStatus({ kind: 'conflict-failed', reason: limit ? 'limit' : error instanceof ApiError ? 'other' : 'offline' });
        return;
      }
    }
    await this.finishConflict(reason, copy);
  }

  private async finishConflict(reason: ReloadReason, copy: ConflictCopy | null) {
    try {
      await this.deps.reload(reason, copy);
    } catch {
      this.conflict = reason;
      this.setStatus({ kind: 'conflict-failed', reason: 'offline' });
      return;
    }
    this.conflict = null;
    this.removeDraft();
  }

  private row(): DraftRow {
    const { userId, resumeId, tabId } = this.deps;
    return { userId, resumeId, tabId, baseVersion: this.currentVersion, document: this.local as ResumeDocument, attempt: this.attempt, copyAttempt: this.copyAttempt, updatedAt: Date.now() };
  }

  private removeDraft() { void this.persist(); }

  /** Writes the latest state, or removes the row when clean. Overlapping requests collapse into one follow-up. */
  private persist(): Promise<void> {
    if (this.persisting) { this.persistAgain = true; return this.persisting; }
    this.persisting = this.persistLoop().finally(() => { this.persisting = null; });
    return this.persisting;
  }

  private async persistLoop() {
    const { userId, resumeId, tabId, store } = this.deps;
    try {
      do {
        this.persistAgain = false;
        if (this.stopped) return;
        if (this.unsynced) await store.put(this.row());
        else await store.remove(userId, resumeId, tabId);
      } while (this.persistAgain);
    } catch { /* A failed local write must not stop the save; the edits are in memory and on their way. */ }
  }
}
