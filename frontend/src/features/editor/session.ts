import { browserDraftStore, writeLastSection, type DraftRow, type DraftStore } from '../../entities/resume/local-data';
import type { ResumeDocument } from '../../entities/resume/operations';
import { ApiError } from '../../shared/api/client';
import { reportClientEvent } from '../../shared/api/client-events';
import { getResume, getSnapshot, removePhoto, saveTransport, updatePhotoCrop, uploadPhoto, type PhotoCrop, type PhotoInfo, type Resume } from './api';
import { AutosaveQueue, type ConflictCopy, type ReloadReason, type SaveStatus } from './autosave';
import { EditHistory } from './history';

export type Selection = string;
export const HEADER: Selection = 'header';
export type EditorPhase = 'loading' | 'ready' | 'trashed' | 'gone' | 'failed' | 'expired';
export type Notice =
  | { kind: 'latest' }
  | { kind: 'copied'; copy: ConflictCopy; reason: ReloadReason }
  | { kind: 'deleted'; title: string }
  | { kind: 'restored'; when: string };
/** What a preview click pointed at inside a section (DD-P11-06). Not history and not stored. */
export type Reveal = { entryId: string | null; itemId: string | null };
export type EditorSnapshot = {
  phase: EditorPhase; document: ResumeDocument | null; photo: PhotoInfo | null; selection: Selection; reveal: Reveal | null; status: SaveStatus;
  canUndo: boolean; canRedo: boolean; notice: Notice | null; announcement: string; locked: boolean; unsynced: boolean;
};
export type EditOptions = { label: string; coalesce?: string | null; select?: Selection };

const TAB_KEY = 'resumiser:tab';
const lockName = (tabId: string) => `resumiser-tab-${tabId}`;
let heldTab: Promise<string> | null = null;

/** One ID per tab, held by a Web Lock for the page's life so another tab can tell this one is alive (DD-P08-05). */
function tabIdentity(): Promise<string> {
  heldTab ??= (async () => {
    const stored = sessionStorage.getItem(TAB_KEY);
    const candidate = stored ?? crypto.randomUUID();
    if (!navigator.locks) { sessionStorage.setItem(TAB_KEY, candidate); return candidate; }
    // A duplicated browser tab copies sessionStorage, so the stored ID may belong to a live tab.
    const taken = (await navigator.locks.query()).held?.some(lock => lock.name === lockName(candidate));
    const id = taken ? crypto.randomUUID() : candidate;
    sessionStorage.setItem(TAB_KEY, id);
    void navigator.locks.request(lockName(id), () => new Promise<void>(() => {}));
    return id;
  })();
  return heldTab;
}

async function liveTabs(): Promise<Set<string>> {
  if (!navigator.locks) return new Set();
  const held = (await navigator.locks.query()).held ?? [];
  return new Set(held.map(lock => lock.name ?? ''));
}

const validSelection = (document: ResumeDocument, selection: Selection) =>
  selection === HEADER || document.sections.some(section => section.id === selection) ? selection : HEADER;

/** The single owner of local editor state: forms render from its snapshot and change it through `apply`. */
export class EditorSession {
  private history: EditHistory<ResumeDocument, Selection> | null = null;
  private queue: AutosaveQueue | null = null;
  private listeners = new Set<() => void>();
  private channel: BroadcastChannel | null = null;
  private tabId = '';
  private disposed = false;
  private photoKeys = new Map<string, string>();
  /** When the server last acknowledged this resume: the date of its next PDF (ADR-010 §7, DD-P12-02). */
  updatedAt = '';
  private snapshot: EditorSnapshot = { phase: 'loading', document: null, photo: null, selection: HEADER, reveal: null, status: { kind: 'saved' }, canUndo: false, canRedo: false, notice: null, announcement: '', locked: false, unsynced: false };

  constructor(readonly resumeId: string, readonly userId: string, private readonly preferred: Selection | null, private readonly store: DraftStore = browserDraftStore()) {}

  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;

  private update(change: Partial<EditorSnapshot> = {}) {
    if (this.disposed) return;
    const history = this.history;
    this.snapshot = {
      ...this.snapshot, ...change,
      document: history?.document ?? change.document ?? this.snapshot.document,
      canUndo: history?.canUndo ?? false, canRedo: history?.canRedo ?? false,
      locked: this.queue?.locked ?? false, unsynced: this.queue?.unsynced ?? false,
    };
    for (const listener of this.listeners) listener();
  }

  async open() {
    this.tabId = await tabIdentity();
    if (this.disposed) return;
    this.queue = new AutosaveQueue({
      userId: this.userId, resumeId: this.resumeId, tabId: this.tabId, store: this.store, transport: saveTransport(this.resumeId, updatedAt => { this.updatedAt = updatedAt; }),
      newKey: () => crypto.randomUUID(), isOnline: () => navigator.onLine,
      reload: (reason, copy) => this.reload(reason, copy),
      onStatus: status => { this.update({ status }); this.announceStatus(status); },
      onWarnings: () => { /* The form shows the same R-7 hint from the document itself. */ },
      onClientEvent: (type, code) => reportClientEvent(type, code, this.resumeId, null),
      onAck: version => { this.channel?.postMessage({ userId: this.userId, resumeId: this.resumeId, tabId: this.tabId, version }); this.update(); },
    });
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('resumiser-resume-versions');
      this.channel.onmessage = ({ data }) => {
        if (data?.userId === this.userId && data?.resumeId === this.resumeId && data?.tabId !== this.tabId && this.snapshot.phase === 'ready') this.queue?.notifyRemote(data.version);
      };
    }
    let resume: Resume;
    try {
      resume = await getResume(this.resumeId);
    } catch (error) {
      if (this.disposed) return;
      await this.openFailed(error);
      return;
    }
    if (this.disposed) return;
    const rows = await this.recoverableRows();
    if (this.disposed) return;
    this.show(resume);
    const newest = rows.pop();
    for (const older of rows) await this.queue.rescue(older).catch(() => { /* Stays for the next visit. */ });
    if (newest && !this.disposed) {
      if (newest.tabId !== this.tabId) await this.store.remove(this.userId, this.resumeId, newest.tabId).catch(() => {});
      this.history = new EditHistory(newest.document, this.snapshot.selection);
      this.queue.adopt(newest, resume.document, resume.version);
      this.update({ phase: 'ready', document: newest.document });
    }
  }

  private async openFailed(error: unknown) {
    if (error instanceof ApiError && error.status === 401) { this.update({ phase: 'expired' }); return; }
    if (error instanceof ApiError && error.status === 404) {
      let notice: Notice | null = null;
      for (const row of await this.recoverableRows()) {
        const copy = await this.queue?.rescue(row, false).catch(() => null);
        if (copy) notice = { kind: 'copied', copy, reason: 'gone' };
      }
      this.update({ phase: 'gone', notice });
      return;
    }
    this.update({ phase: 'failed' });
  }

  private async recoverableRows(): Promise<DraftRow[]> {
    const [rows, alive] = await Promise.all([this.store.list(this.userId, this.resumeId).catch(() => []), liveTabs().catch(() => new Set<string>())]);
    return rows.filter(row => row.tabId === this.tabId || !alive.has(lockName(row.tabId))).sort((a, b) => a.updatedAt - b.updatedAt);
  }

  private show(resume: Resume, notice: Notice | null = this.snapshot.notice) {
    this.updatedAt = resume.updatedAt;
    if (resume.deletedAt) {
      this.history = null;
      this.queue?.start(resume.document, resume.version);
      this.update({ phase: 'trashed', document: resume.document, notice });
      return;
    }
    const selection = validSelection(resume.document, this.snapshot.phase === 'loading' ? this.preferred ?? HEADER : this.snapshot.selection);
    this.history = new EditHistory(resume.document, selection);
    this.queue?.start(resume.document, resume.version);
    this.update({ phase: 'ready', document: resume.document, photo: resume.photo, selection, notice });
  }

  private async reload(reason: ReloadReason, copy: ConflictCopy | null) {
    const notice: Notice | null = copy ? { kind: 'copied', copy, reason } : reason === 'conflict' || reason === 'remote' ? { kind: 'latest' } : null;
    let resume: Resume;
    try {
      resume = await getResume(this.resumeId);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        this.history = null;
        this.update({ phase: 'gone', notice });
        this.queue?.start(this.snapshot.document as ResumeDocument, this.queue.version);
        return;
      }
      throw error;
    }
    // An edit typed while the newer version was on its way wins for now; its write then meets the normal conflict flow.
    if (reason === 'remote' && this.queue?.unsynced) return;
    this.show(resume, notice);
  }

  private announceStatus(status: SaveStatus) {
    const text: Partial<Record<SaveStatus['kind'], string>> = { offline: 'Offline, changes kept locally', unavailable: 'Server unavailable, changes kept locally', 'session-expired': 'Your session expired. Your changes are kept on this device.', 'not-saved': 'Not saved', invalid: 'Not saved. This resume could not be saved as it is.', 'conflict-failed': 'Your changes could not be saved as a copy.' };
    const message = text[status.kind];
    if (message) this.update({ announcement: message });
  }

  apply(change: (document: ResumeDocument) => ResumeDocument, options: EditOptions) {
    if (!this.history || !this.queue || this.queue.locked) return;
    const next = change(this.history.document);
    if (next === this.history.document) return;
    const selection = options.select ?? this.snapshot.selection;
    this.history.push(next, selection, options.label, options.coalesce ?? null, Date.now());
    this.queue.edit(next);
    if (selection !== this.snapshot.selection) writeLastSection(this.userId, this.resumeId, selection);
    this.update({ selection, notice: options.select === undefined ? this.keepNotice() : this.snapshot.notice });
  }

  /** A deletion's Undo stays only until the next edit; conflict notices stay until dismissed. */
  private keepNotice() { return this.snapshot.notice?.kind === 'deleted' || this.snapshot.notice?.kind === 'restored' ? null : this.snapshot.notice; }

  select(selection: Selection, reveal: Reveal | null = null) {
    this.history?.setSelection(selection);
    writeLastSection(this.userId, this.resumeId, selection);
    this.update({ selection, reveal });
  }

  undo() { this.travel('undo'); }
  redo() { this.travel('redo'); }

  private travel(direction: 'undo' | 'redo') {
    if (!this.history || !this.queue || this.queue.locked) return;
    const step = direction === 'undo' ? this.history.undo() : this.history.redo();
    if (!step) return;
    this.queue.edit(step.document);
    const selection = validSelection(step.document, step.selection);
    if (selection !== this.snapshot.selection) writeLastSection(this.userId, this.resumeId, selection);
    this.update({ selection, notice: this.keepNotice(), announcement: `${direction === 'undo' ? 'Undid' : 'Redid'} ${step.label}` });
  }

  announce(announcement: string) { this.update({ announcement }); }
  showNotice(notice: Notice | null) { this.update({ notice }); }

  retryNow() { this.queue?.retryNow(); }
  flush() { this.queue?.flush(); }
  async retryCopy() { await this.queue?.retryCopy(); this.update(); }
  async discard() { await this.queue?.discard(); this.update(); }

  private photoKey(action: string) {
    const key = this.photoKeys.get(action) ?? crypto.randomUUID();
    this.photoKeys.set(action, key);
    return key;
  }

  /** One key per logical action until its outcome is known, as in the library (ADR-037 §4). */
  private async photoOperation<T extends { version: number; updatedAt: string }>(action: string, operation: (version: number, key: string) => Promise<T>) {
    if (!this.queue) throw new Error('Not open');
    const key = this.photoKey(action);
    try {
      const result = await this.queue.runExclusive(version => operation(version, key));
      this.photoKeys.delete(action);
      this.updatedAt = result.updatedAt;
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status < 500) this.photoKeys.delete(action);
      throw error;
    }
  }

  async uploadPhoto(file: File) {
    const result = await this.photoOperation(`upload:${file.name}:${file.size}:${file.lastModified}`, (version, key) => uploadPhoto(this.resumeId, file, version, key));
    this.update({ photo: result.photo });
    return result.photo;
  }

  async cropPhoto(crop: PhotoCrop) {
    const result = await this.photoOperation(`crop:${JSON.stringify(crop)}`, (version, key) => updatePhotoCrop(this.resumeId, crop, version, key));
    this.update({ photo: result.photo });
  }

  async removePhoto() {
    await this.photoOperation('remove', (version, key) => removePhoto(this.resumeId, version, key));
    this.update({ photo: null });
  }

  async restoreSnapshot(snapshotId: string, when: string) {
    const snapshot = await getSnapshot(this.resumeId, snapshotId);
    this.apply(() => snapshot.document, { label: 'restore version' });
    this.update({ notice: { kind: 'restored', when } });
  }

  dispose() {
    this.disposed = true;
    this.channel?.close();
    this.channel = null;
    this.queue?.leave();
  }
}
