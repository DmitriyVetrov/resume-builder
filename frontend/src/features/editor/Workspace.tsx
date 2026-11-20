import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { readLastSection } from '../../entities/resume/local-data';
import { LIMITS, type ResumeDocument, type Section } from '../../entities/resume/operations';
import { Button, buttonClass, LoadingSkeleton } from '../../shared/ui';
import { NOTICE_ACTION } from './controls';
import type { PhotoInfo } from './api';
import { useSession } from '../account/session';
import { ExportActions } from '../export/ExportActions';
import type { PageModelState } from '../preview-paint/use-page-model';
import { usePageModel } from '../preview-paint/use-page-model';
import type { SaveStatus } from './autosave';
import { LimitedField } from './controls';
import { DesignPanel } from './DesignPanel';
import { HeaderForm } from './forms/HeaderForm';
import { SectionForm } from './forms/SectionForm';
import { PreviewPanel } from './PreviewPanel';
import { SectionPanel, sectionName } from './SectionPanel';
import { EditorSession, HEADER, type Notice } from './session';
import { VersionHistory } from './VersionHistory';
import './editor.css';

const panels = ['Sections', 'Edit', 'Preview', 'Design'] as const;
type Panel = typeof panels[number];

function describePointer(document: ResumeDocument, pointer: string | null) {
  const match = pointer && /^\/sections\/(\d+)/.exec(pointer);
  if (match) return `"${sectionName(document.sections[Number(match[1])] ?? { title: '' })}"`;
  if (pointer?.startsWith('/header')) return 'the header';
  return null;
}

function statusText(status: SaveStatus, document: ResumeDocument): { text: string; tone: string } {
  switch (status.kind) {
    case 'saved': return { text: 'Saved', tone: 'ok' };
    case 'saving': return { text: 'Saving…', tone: 'busy' };
    case 'offline': return { text: 'Offline, changes kept locally', tone: 'warn' };
    case 'unavailable': return { text: 'Server unavailable, changes kept locally', tone: 'warn' };
    case 'not-saved': return { text: 'Not saved, trying again', tone: 'bad' };
    case 'session-expired': return { text: 'Session expired, changes kept locally', tone: 'bad' };
    case 'conflict-saving': return { text: 'Saving your changes as a copy…', tone: 'busy' };
    case 'conflict-failed': return { text: 'Not saved', tone: 'bad' };
    case 'invalid': {
      if (status.code === 'resume_text_limit_exceeded') return { text: 'Not saved: this resume is over 50,000 characters', tone: 'bad' };
      const where = describePointer(document, status.pointer);
      return { text: where ? `Not saved: check ${where}` : 'Not saved: this resume could not be saved as it is', tone: 'bad' };
    }
  }
}

function NoticeStrip({ session, notice }: { session: EditorSession; notice: Notice }) {
  const undo = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (notice.kind === 'deleted') undo.current?.focus(); }, [notice]);
  return <div className="editor-notice" role="status">
    {notice.kind === 'latest' && <span>This resume was changed in another tab or device. Showing the latest version.</span>}
    {notice.kind === 'copied' && <span>Your unsaved changes were kept in <Link to={`/resumes/${notice.copy.id}/edit`}>{notice.copy.title}</Link>.</span>}
    {notice.kind === 'deleted' && <><span>Deleted {notice.title}.</span><Button ref={undo} type="button" variant="secondary" size="sm" className={NOTICE_ACTION} onClick={() => session.undo()}>Undo delete</Button></>}
    {notice.kind === 'restored' && <><span>Restored the version from {notice.when}.</span><Button type="button" variant="secondary" size="sm" className={NOTICE_ACTION} onClick={() => session.undo()}>Undo restore</Button></>}
    <Button type="button" variant="secondary" size="sm" className={NOTICE_ACTION} aria-label="Dismiss notice" onClick={() => session.showNotice(null)}>Dismiss</Button>
  </div>;
}

function ConflictChoice({ session, status }: { session: EditorSession; status: Extract<SaveStatus, { kind: 'conflict-failed' }> }) {
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => { setBusy(true); try { await action(); } finally { setBusy(false); } };
  const reason = status.reason === 'limit' ? 'You have reached the limit of 200 resumes, so a copy could not be created. Delete a resume and try again.'
    : status.reason === 'offline' ? 'A copy could not be created because the connection failed.'
      : 'A copy could not be created.';
  return <div className="editor-notice error" role="alert">
    <span>This resume changed elsewhere. {reason} Your changes are kept on this device.</span>
    <Button type="button" variant="secondary" size="sm" className={NOTICE_ACTION} disabled={busy} onClick={() => void run(() => session.retryCopy())}>Retry saving as a copy</Button>
    <Button type="button" variant="secondary" size="sm" className={NOTICE_ACTION} disabled={busy} onClick={() => void run(() => session.discard())}>Discard my changes</Button>
  </div>;
}

function TopBar({ session, document, status, canUndo, canRedo, onHistory, photo, pageModel, onEditHeader }: { session: EditorSession; document: ResumeDocument; status: SaveStatus; canUndo: boolean; canRedo: boolean; onHistory: () => void; photo: PhotoInfo | null; pageModel: PageModelState; onEditHeader: () => void }) {
  const { text, tone } = statusText(status, document);
  return <div className="editor-topbar">
    <LimitedField id="resume-title" label="Resume title" className="title-input h-10 border-transparent font-semibold hover:border-input" limit={LIMITS.title} value={document.title} onValue={title => session.apply(current => ({ ...current, title }), { label: 'title edit', coalesce: 'title' })} />
    <p className={`save-status ${tone}`} data-testid="save-status"><span className="status-dot" aria-hidden="true" />{text}</p>
    {status.kind === 'session-expired' && <Link className="login-link" to={`/login?returnTo=${encodeURIComponent(window.location.pathname)}`}>Log in</Link>}
    <div className="topbar-actions">
      <Button variant="secondary" disabled={!canUndo} onClick={() => session.undo()}>Undo</Button>
      <Button variant="secondary" disabled={!canRedo} onClick={() => session.redo()}>Redo</Button>
      <Button variant="secondary" onClick={onHistory}>Version history</Button>
    </div>
    <ExportActions session={session} document={document} photo={photo} pageModel={pageModel} onEditHeader={onEditHeader} />
  </div>;
}

function Editing({ session }: { session: EditorSession }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [active, setActive] = useState<Panel>('Sections');
  const [right, setRight] = useState<'Preview' | 'Design'>('Preview');
  const [history, setHistory] = useState(false);
  const titleFocus = useRef<string | null>(null);
  const { document, selection, reveal, status, unsynced } = state;
  const pageModel = usePageModel(document, state.photo !== null, session.resumeId);
  useEffect(() => {
    if (!unsynced) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsynced]);
  useEffect(() => {
    // Capture level: native undo in an input or the rich-text engine would desynchronise a controlled field (DD-P08-03).
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'z') return;
      if ((event.target as Element | null)?.closest?.('[role="dialog"]')) return;
      event.preventDefault();
      if (event.shiftKey) session.redo();
      else session.undo();
    };
    const native = (event: InputEvent) => {
      if ((event.target as Element | null)?.closest?.('[role="dialog"]')) return;
      if (event.inputType === 'historyUndo') { event.preventDefault(); session.undo(); }
      if (event.inputType === 'historyRedo') { event.preventDefault(); session.redo(); }
    };
    const online = () => session.retryNow();
    const hidden = () => { if (window.document.visibilityState === 'hidden') session.flush(); };
    window.addEventListener('keydown', keys, true);
    window.addEventListener('beforeinput', native as EventListener, true);
    window.addEventListener('online', online);
    window.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('keydown', keys, true);
      window.removeEventListener('beforeinput', native as EventListener, true);
      window.removeEventListener('online', online);
      window.removeEventListener('visibilitychange', hidden);
    };
  }, [session]);
  const openEdit = useCallback(() => setActive('Edit'), []);
  const editHeader = useCallback(() => {
    session.select(HEADER);
    setActive('Edit');
    // After the form for the header has replaced whatever section was open.
    setTimeout(() => window.document.querySelector<HTMLInputElement>('.panel-edit input[id$="-name"]')?.focus(), 0);
  }, [session]);
  const takeTitleFocus = useCallback((id: string) => {
    const wanted = titleFocus.current === id;
    if (wanted) titleFocus.current = null;
    return wanted;
  }, []);
  if (!document) return null;
  const section = selection === HEADER ? null : (document.sections.find(item => item.id === selection) as Section | undefined) ?? null;
  const panel = (name: Panel, body: ReactNode) => <section key={name} className={`editor-panel panel-${name.toLowerCase()} ${active === name ? 'active' : ''} ${name === 'Preview' || name === 'Design' ? (right === name ? 'right-active' : 'right-inactive') : ''}`} role="region" aria-label={name}>
    <div role="tabpanel" id={`panel-${name}`} aria-labelledby={`tab-${name}`} tabIndex={0} className="panel-body">{body}</div>
  </section>;
  return <>
    <TopBar session={session} document={document} status={status} canUndo={state.canUndo} canRedo={state.canRedo} onHistory={() => setHistory(true)} photo={state.photo} pageModel={pageModel} onEditHeader={editHeader} />
    {state.notice && <NoticeStrip session={session} notice={state.notice} />}
    {status.kind === 'conflict-failed' && <ConflictChoice session={session} status={status} />}
    <div className="editor-layout" inert={state.locked}>
      <div className="panel-tabs" role="tablist" aria-label="Editor panels">
        {panels.map(name => <button key={name} type="button" role="tab" id={`tab-${name}`} aria-controls={`panel-${name}`} aria-selected={active === name} onClick={() => setActive(name)}>{name}</button>)}
      </div>
      {panel('Sections', <SectionPanel session={session} document={document} selection={selection} onSelected={openEdit} onAdded={id => { titleFocus.current = id; setActive('Edit'); }} />)}
      {panel('Edit', <>
        <h2 className="panel-title">Edit</h2>
        {section ? <SectionForm key={section.id} session={session} section={section} reveal={reveal} takeTitleFocus={takeTitleFocus} /> : <HeaderForm session={session} document={document} photo={state.photo} />}
      </>)}
      <div className="right-column">
        <div className="right-tabs" role="tablist" aria-label="Preview panel">
          {(['Preview', 'Design'] as const).map(name => <button key={name} type="button" role="tab" id={`right-tab-${name}`} aria-controls={`panel-${name}`} aria-selected={right === name} onClick={() => setRight(name)}>{name}</button>)}
        </div>
        {panel('Preview', <>
          <h2 className="panel-title">Preview</h2>
          <PreviewPanel session={session} document={document} photo={state.photo} selection={selection} pageModel={pageModel} onActivate={openEdit} />
        </>)}
        {panel('Design', <>
          <h2 className="panel-title">Design</h2>
          <DesignPanel session={session} document={document} photo={state.photo} pageModel={pageModel} visible={right === 'Design' || active === 'Design'} />
        </>)}
      </div>
    </div>
    {history && <VersionHistory session={session} onClose={() => setHistory(false)} />}
    <div className="sr-only" role="status" aria-live="polite" data-testid="announcer">{state.announcement}</div>
  </>;
}

function Opened({ session, onRetry }: { session: EditorSession; onRetry: () => void }) {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => { if (state.phase === 'expired') navigate(`/login?returnTo=${encodeURIComponent(pathname)}`, { replace: true }); }, [state.phase, navigate, pathname]);
  switch (state.phase) {
    case 'loading': case 'expired': return <div className="editor-state"><LoadingSkeleton label="Loading resume…" /></div>;
    case 'failed': return <div className="editor-state" role="alert"><p>This resume could not be loaded.</p><Button onClick={onRetry}>Retry</Button></div>;
    case 'gone': return <div className="editor-state">
      {state.notice && <NoticeStrip session={session} notice={state.notice} />}
      <p>This resume is no longer available.</p><Link className={buttonClass()} to="/resumes">Back to your resumes</Link></div>;
    case 'trashed': return <div className="editor-state">
      {state.notice && <NoticeStrip session={session} notice={state.notice} />}
      <p>This resume is in the trash and cannot be edited. Restore it to keep working on it.</p><Link className={buttonClass()} to="/resumes/trash">Open Trash</Link></div>;
    case 'ready': return <Editing session={session} />;
  }
}

/** Route page: the session user namespaces local data, so the session is known before anything opens. */
export function EditorPage() {
  const { resumeId = '' } = useParams();
  const { refresh } = useSession();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [session, setSession] = useState<EditorSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    let opened: EditorSession | null = null;
    refresh(true).then(info => {
      if (!current) return;
      if (!info.authenticated || !info.user) { navigate(`/login?returnTo=${encodeURIComponent(pathname)}`, { replace: true }); return; }
      opened = new EditorSession(resumeId, info.user.id, readLastSection(info.user.id, resumeId));
      setSession(opened);
      void opened.open();
    }, () => { if (current) setFailed(true); });
    return () => { current = false; opened?.dispose(); setSession(null); };
  }, [attempt, navigate, pathname, refresh, resumeId]);
  const retry = () => { setFailed(false); setAttempt(count => count + 1); };
  return <main id="main-content" className="editor-main">
    <h1 className="sr-only">Resume editor</h1>
    {failed && <div className="editor-state" role="alert"><p>This resume could not be loaded.</p><Button onClick={retry}>Retry</Button></div>}
    {!failed && !session && <div className="editor-state"><LoadingSkeleton label="Loading resume…" /></div>}
    {session && <Opened session={session} onRetry={retry} />}
  </main>;
}
