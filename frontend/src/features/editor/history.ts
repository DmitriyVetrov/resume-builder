export type HistoryStep<D, S> = { document: D; selection: S; label: string };
export const HISTORY_LIMIT = 100;
export const COALESCE_MS = 1000;

type Entry<D, S> = { before: D; beforeSelection: S; after: D; afterSelection: S; label: string; key: string | null; at: number };

/** One document-level stack over immutable documents (DD-P08-03). */
export class EditHistory<D, S> {
  private current: D;
  private selection: S;
  private past: Entry<D, S>[] = [];
  private future: Entry<D, S>[] = [];

  constructor(document: D, selection: S) { this.current = document; this.selection = selection; }

  get document() { return this.current; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get undoLabel() { return this.past.at(-1)?.label ?? null; }
  get redoLabel() { return this.future.at(-1)?.label ?? null; }

  push(document: D, selection: S, label: string, coalesceKey: string | null, now: number) {
    this.future = [];
    const last = this.past.at(-1);
    if (last && coalesceKey !== null && last.key === coalesceKey && now - last.at < COALESCE_MS) {
      last.after = document;
      last.afterSelection = selection;
      last.at = now;
    } else {
      this.past.push({ before: this.current, beforeSelection: this.selection, after: document, afterSelection: selection, label, key: coalesceKey, at: now });
      if (this.past.length > HISTORY_LIMIT) this.past.shift();
    }
    this.current = document;
    this.selection = selection;
  }

  undo(): HistoryStep<D, S> | null {
    const entry = this.past.pop();
    if (!entry) return null;
    entry.key = null;
    this.future.push(entry);
    this.current = entry.before;
    this.selection = entry.beforeSelection;
    return { document: entry.before, selection: entry.beforeSelection, label: entry.label };
  }

  redo(): HistoryStep<D, S> | null {
    const entry = this.future.pop();
    if (!entry) return null;
    this.past.push(entry);
    this.current = entry.after;
    this.selection = entry.afterSelection;
    return { document: entry.after, selection: entry.afterSelection, label: entry.label };
  }

  setSelection(selection: S) { this.selection = selection; }
}
