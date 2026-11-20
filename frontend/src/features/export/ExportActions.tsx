import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { readLineEnding, writeLineEnding, type LineEnding } from '../../entities/resume/local-data';
import type { ResumeDocument } from '../../entities/resume/operations';
import { Button } from '../../shared/ui';
import type { PhotoInfo } from '../editor/api';
import { NOTICE_ACTION } from '../editor/controls';
import type { EditorSession } from '../editor/session';
import type { PageModelState } from '../preview-paint/use-page-model';
import { copyText, exportPdf, exportTxt, failureMessage, pdfMessage } from './export';
import { FULL_NAME_REASON, hasFullName, useEmailVerified, VERIFY_REASON } from './gate';

type Props = { session: EditorSession; document: ResumeDocument; photo: PhotoInfo | null; pageModel: PageModelState; onEditHeader: () => void };

/** FR-EDT-06, FR-PDF-01, FR-TXT-01. Blocked buttons stay focusable and say why (FR-TYP-03, DD-P12-06). */
export function ExportActions({ session, document, photo, pageModel, onEditHeader }: Props) {
  const verified = useEmailVerified();
  const named = hasFullName(document);
  const blocked = !verified || !named;
  const [lineEnding, setLineEnding] = useState<LineEnding>(() => readLineEnding(session.userId));
  const [note, setNote] = useState<{ text: string; error: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  const run = async (kind: 'PDF' | 'text file' | 'copy', action: () => Promise<string>) => {
    if (blocked || running.current) return;
    running.current = true;
    setBusy(true);
    setNote(null);
    try {
      const text = await action();
      setNote({ text, error: false });
      session.announce(text);
    } catch (error) {
      setNote({ text: failureMessage(error, kind), error: true });
    } finally {
      running.current = false;
      setBusy(false);
    }
  };
  const source = () => {
    session.flush();
    return { resumeId: session.resumeId, document, updatedAt: session.updatedAt, photo, preview: pageModel };
  };
  const pdf = () => void run('PDF', async () => pdfMessage(await exportPdf(source())));
  const txt = () => void run('text file', async () => `Exported ${(await exportTxt(source(), lineEnding)).fileName}.`);
  const copy = () => void run('copy', async () => { await copyText(document, lineEnding); return 'Copied as text.'; });
  const chooseLineEnding = (value: LineEnding) => { setLineEnding(value); writeLineEnding(session.userId, value); };

  const reasons = [!named && 'export-reason-name', !verified && 'export-reason-verify'].filter(Boolean).join(' ') || undefined;
  const state = { 'aria-disabled': blocked || busy, 'aria-describedby': reasons };
  return <>
    <div className="export-actions">
      <Button variant="secondary" {...state} onClick={pdf}>Export PDF</Button>
      <Button variant="secondary" {...state} onClick={txt}>Export TXT</Button>
      <details className="export-options" onKeyDown={event => { if (event.key === 'Escape') event.currentTarget.open = false; }}>
        <summary>Text options</summary>
        <div className="export-options-panel">
          <label><input type="checkbox" className="accent-(--color-brand)" checked={lineEnding === 'crlf'} onChange={event => chooseLineEnding(event.target.checked ? 'crlf' : 'lf')} /> Windows line endings (CRLF)</label>
          <Button variant="secondary" {...state} onClick={copy}>Copy as text</Button>
        </div>
      </details>
    </div>
    {blocked && <div className="export-note">
      {!named && <p><span id="export-reason-name">{FULL_NAME_REASON}</span> <Button type="button" variant="secondary" size="sm" className={NOTICE_ACTION} onClick={onEditHeader}>Edit header</Button></p>}
      {!verified && <p><span id="export-reason-verify">{VERIFY_REASON}</span> <Link to="/verify-email">Resend verification</Link></p>}
    </div>}
    {note && (note.error ? <p className="export-note error" role="alert">{note.text}</p> : <p className="export-note">{note.text}</p>)}
  </>;
}
