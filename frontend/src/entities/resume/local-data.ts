import type { ResumeDocument } from './operations';

export type WriteAttempt = { body: string; key: string; version: number };
export type CopyAttempt = { body: string; key: string };
export type DraftRow = { userId: string; resumeId: string; tabId: string; baseVersion: number; document: ResumeDocument; attempt: WriteAttempt | null; copyAttempt: CopyAttempt | null; updatedAt: number };
export interface DraftStore {
  put(row: DraftRow): Promise<void>;
  remove(userId: string, resumeId: string, tabId: string): Promise<void>;
  list(userId: string, resumeId: string): Promise<DraftRow[]>;
}

const DATABASE = 'resumiser-local';
const STORE = 'drafts';
const SECTION_PREFIX = 'resumiser:last-section:';
const LINE_ENDING_PREFIX = 'resumiser:txt-line-ending:';
const sameRow = (row: DraftRow, userId: string, resumeId: string, tabId: string) => row.userId === userId && row.resumeId === resumeId && row.tabId === tabId;

export function memoryDraftStore(): DraftStore & { rows: DraftRow[] } {
  const rows: DraftRow[] = [];
  return {
    rows,
    async put(row) {
      const index = rows.findIndex(item => sameRow(item, row.userId, row.resumeId, row.tabId));
      if (index >= 0) rows[index] = row;
      else rows.push(row);
    },
    async remove(userId, resumeId, tabId) {
      const index = rows.findIndex(item => sameRow(item, userId, resumeId, tabId));
      if (index >= 0) rows.splice(index, 1);
    },
    async list(userId, resumeId) { return rows.filter(row => row.userId === userId && row.resumeId === resumeId); },
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE, { keyPath: ['userId', 'resumeId', 'tabId'] });
      store.createIndex('userId', 'userId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(STORE, mode);
    const result = await requestResult(action(transaction.objectStore(STORE)));
    if (mode === 'readwrite') await new Promise<void>((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
    return result;
  } finally { database.close(); }
}

const memoryFallback = memoryDraftStore();

/** Per-user IndexedDB rows, one per tab (DD-P08-05). A browser without IndexedDB keeps them in memory for the session. */
export function browserDraftStore(): DraftStore {
  if (typeof indexedDB === 'undefined') return memoryFallback;
  return {
    async put(row) { await withStore('readwrite', store => store.put(row)); },
    async remove(userId, resumeId, tabId) { await withStore('readwrite', store => store.delete([userId, resumeId, tabId])); },
    async list(userId, resumeId) {
      const rows = await withStore<DraftRow[]>('readonly', store => store.index('userId').getAll(userId));
      return rows.filter(row => row.resumeId === resumeId);
    },
  };
}

const sectionKey = (userId: string, resumeId: string) => `${SECTION_PREFIX}${userId}:${resumeId}`;

function userSectionKeys(userId: string): string[] {
  try { return Object.keys(localStorage).filter(key => key.startsWith(`${SECTION_PREFIX}${userId}:`)); } catch { return []; }
}

async function userDrafts(userId: string): Promise<DraftRow[]> {
  if (typeof indexedDB === 'undefined') return memoryFallback.rows.filter(row => row.userId === userId);
  return withStore<DraftRow[]>('readonly', store => store.index('userId').getAll(userId));
}

/** T-ID-06: what this device holds for the user. Every draft row is by definition not acknowledged yet. */
export async function localDataSummary(userId: string): Promise<{ hasData: boolean; unsynced: boolean }> {
  const [drafts, thumbnails] = await Promise.all([userDrafts(userId).catch(() => []), userThumbnails(userId).catch(() => [])]);
  return { hasData: drafts.length > 0 || thumbnails.length > 0 || userSectionKeys(userId).length > 0, unsynced: drafts.length > 0 };
}

/**
 * ADR-010 §9, DD-P11-10: page 1 of a resume, one row per user and resume. A database of its own, so a failure here cannot
 * touch the store of unacknowledged edits. It holds resume text, so it is local data for T-ID-06.
 */
export type ThumbnailRow = { userId: string; resumeId: string; version: number; engineVersion: string; page: unknown; photoUrl: string | null };
const THUMBNAILS = 'resumiser-thumbnails';
const PAGES = 'pages';
const memoryThumbnails: ThumbnailRow[] = [];

function thumbnailStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(THUMBNAILS, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(PAGES, { keyPath: ['userId', 'resumeId'] }).createIndex('userId', 'userId'); };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction(PAGES, mode);
      const result = action(transaction.objectStore(PAGES));
      transaction.oncomplete = () => { database.close(); resolve(result.result); };
      transaction.onerror = transaction.onabort = () => { database.close(); reject(transaction.error); };
    };
  });
}

function userThumbnails(userId: string): Promise<ThumbnailRow[]> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(memoryThumbnails.filter(row => row.userId === userId));
  return thumbnailStore<ThumbnailRow[]>('readonly', store => store.index('userId').getAll(userId));
}

export async function readThumbnail(userId: string, resumeId: string): Promise<ThumbnailRow | null> {
  if (typeof indexedDB === 'undefined') return memoryThumbnails.find(row => row.userId === userId && row.resumeId === resumeId) ?? null;
  return (await thumbnailStore<ThumbnailRow | undefined>('readonly', store => store.get([userId, resumeId]))) ?? null;
}

export async function writeThumbnail(row: ThumbnailRow): Promise<void> {
  if (typeof indexedDB !== 'undefined') { await thumbnailStore('readwrite', store => store.put(row)); return; }
  await removeThumbnail(row.userId, row.resumeId);
  memoryThumbnails.push(row);
}

export async function removeThumbnail(userId: string, resumeId: string): Promise<void> {
  if (typeof indexedDB !== 'undefined') { await thumbnailStore('readwrite', store => store.delete([userId, resumeId])); return; }
  const index = memoryThumbnails.findIndex(row => row.userId === userId && row.resumeId === resumeId);
  if (index >= 0) memoryThumbnails.splice(index, 1);
}

/** Keeps only `keep` for this user: a resume deleted elsewhere does not stay readable on this device. */
export async function pruneThumbnails(userId: string, keep: ReadonlySet<string>): Promise<void> {
  const rows = await userThumbnails(userId).catch(() => []);
  await Promise.all(rows.filter(row => !keep.has(row.resumeId)).map(row => removeThumbnail(userId, row.resumeId).catch(() => {})));
}

const removalListeners = new Set<(userId: string) => void>();

/** A running autosave queue stops when its user's local data is removed, so it cannot write the row back. */
export function onLocalDataRemoved(listener: (userId: string) => void): () => void {
  removalListeners.add(listener);
  return () => removalListeners.delete(listener);
}

export async function removeLocalData(userId: string): Promise<void> {
  for (const listener of removalListeners) listener(userId);
  const drafts = await userDrafts(userId).catch(() => []);
  const store = browserDraftStore();
  await Promise.all(drafts.map(row => store.remove(row.userId, row.resumeId, row.tabId)));
  for (const key of userSectionKeys(userId)) localStorage.removeItem(key);
  try { localStorage.removeItem(`${LINE_ENDING_PREFIX}${userId}`); } catch { /* Nothing was stored, then. */ }
  await pruneThumbnails(userId, new Set());
}

/** FR-TXT-05, DD-P12-14: a device preference, not part of the resume. */
export type LineEnding = 'lf' | 'crlf';

export function readLineEnding(userId: string): LineEnding {
  try { return localStorage.getItem(`${LINE_ENDING_PREFIX}${userId}`) === 'crlf' ? 'crlf' : 'lf'; } catch { return 'lf'; }
}

export function writeLineEnding(userId: string, value: LineEnding): void {
  try { localStorage.setItem(`${LINE_ENDING_PREFIX}${userId}`, value); } catch { /* It lasts this page, then. */ }
}

export function readLastSection(userId: string, resumeId: string): string | null {
  try { return localStorage.getItem(sectionKey(userId, resumeId)); } catch { return null; }
}

export function writeLastSection(userId: string, resumeId: string, sectionId: string): void {
  try { localStorage.setItem(sectionKey(userId, resumeId), sectionId); } catch { /* Storage may be unavailable; opening at Header is a safe fallback. */ }
}

