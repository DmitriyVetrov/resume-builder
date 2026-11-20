import { useEffect, useState } from 'react';
import { problemMessage } from '../../shared/api/client';
import { Button, Dialog, StatusNotice } from '../../shared/ui';
import { listSnapshots, type SnapshotSummary } from './api';
import type { EditorSession } from './session';

const when = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function VersionHistory({ session, onClose }: { session: EditorSession; onClose: () => void }) {
  const [items, setItems] = useState<SnapshotSummary[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let current = true;
    listSnapshots(session.resumeId, null).then(page => {
      if (current) { setItems(page.items); setCursor(page.nextCursor); }
    }, failure => { if (current) { setError(problemMessage(failure)); setItems([]); } });
    return () => { current = false; };
  }, [session]);
  const more = async () => {
    setBusy(true);
    try {
      const page = await listSnapshots(session.resumeId, cursor);
      setItems(previous => [...(previous ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } catch (failure) { setError(problemMessage(failure)); } finally { setBusy(false); }
  };
  const restore = async (item: SnapshotSummary, label: string) => {
    setBusy(true);
    setError('');
    try {
      await session.restoreSnapshot(item.id, label);
      onClose();
    } catch (failure) { setError(problemMessage(failure)); setBusy(false); }
  };
  return <Dialog title="Version history" onClose={onClose} busy={busy}>
    <p className="help">Versions are kept for 30 days. Restoring can be undone.</p>
    {error && <StatusNotice error>{error}</StatusNotice>}
    {items === null && <p role="status">Loading versions…</p>}
    {items?.length === 0 && !error && <p>No saved versions yet.</p>}
    {!!items?.length && <ul className="version-list">
      {items.map(item => {
        const label = when.format(new Date(item.createdAt));
        return <li key={item.id}>
          <span><strong>{label}</strong><small>{item.reason === 'before_export' ? 'Before an export' : 'Automatic'}</small></span>
          <Button variant="secondary" disabled={busy} aria-label={`Restore ${label}`} onClick={() => void restore(item, label)}>Restore</Button>
        </li>;
      })}
    </ul>}
    <div className="dialog-actions">
      {cursor && <Button variant="secondary" disabled={busy} onClick={() => void more()}>Load more</Button>}
      <Button variant="secondary" data-initial-focus disabled={busy} onClick={onClose}>Close</Button>
    </div>
  </Dialog>;
}
