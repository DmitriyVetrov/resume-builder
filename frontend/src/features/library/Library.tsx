import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { blankResumeDocument, copyTitle, displayTitle, TITLE_LIMIT, titleLength } from '../../entities/resume';
import { ApiError, problemMessage } from '../../shared/api/client';
import { pruneThumbnails, readLineEnding } from '../../entities/resume/local-data';
import { Button, buttonClass, CONTROL, Dialog, FieldError, Input, StatusNotice } from '../../shared/ui';
import { Skeleton as SkeletonBlock } from '../../shared/ui/skeleton';
import { useSession } from '../account/session';
import { ExportFailure, exportPdf, exportTxt, failureMessage, pdfMessage } from '../export/export';
import { hasFullName, useEmailVerified, VERIFY_REASON } from '../export/gate';
import { LibraryThumbnail } from './LibraryThumbnail';
import { createResume, getResume, listResumes, purgeResume, replaceDocument, restoreResume, trashResume, type CreateResumeRequest, type ListState, type Resume, type ResumeSummary } from './api';

const CONFLICT_MESSAGE = 'This resume changed elsewhere. Reload and try again.';
const GONE_MESSAGE = 'This resume is no longer available.';

function libraryMessage(error: unknown): string {
  if (error instanceof ApiError) {
    switch (error.problem?.code) {
      case 'version_mismatch': return CONFLICT_MESSAGE;
      case 'not_found': return GONE_MESSAGE;
      case 'resume_trashed': return 'This resume is in the trash now.';
      case 'resume_not_trashed': return 'This resume is no longer in the trash.';
      case 'idempotency_request_in_progress': return 'The previous request is still running. Try again in a moment.';
      case 'validation_failed': return 'This resume could not be saved. Check the name and try again.';
    }
  }
  return problemMessage(error);
}
const isStale = (error: unknown) => error instanceof ApiError && (error.problem?.code === 'version_mismatch' || error.problem?.code === 'not_found');
const isLimit = (error: unknown) => error instanceof ApiError && error.problem?.code === 'limit_reached';

/**
 * True when the answer proves the attempt wrote nothing. A network failure, a 5xx or an in-flight duplicate does
 * not, so a retry must repeat the same key and body: with a new key it could apply the effect twice (ADR-037 §4).
 */
const provesNothingWritten = (error: unknown) =>
  error instanceof ApiError && error.status < 500 && error.problem?.code !== 'idempotency_request_in_progress';

/** One idempotency key and one request body per logical action, kept until its outcome is known. */
class RetryKeys {
  private readonly attempts = new Map<string, { key: string; body: string }>();

  attempt(action: string, build: () => string = () => '') {
    const attempt = this.attempts.get(action) ?? { key: crypto.randomUUID(), body: build() };
    this.attempts.set(action, attempt);
    return attempt;
  }

  /** Call with the failure, or with nothing after a success. */
  settle(action: string, failure?: unknown) {
    if (failure === undefined || provesNothingWritten(failure)) this.attempts.delete(action);
  }
}

const dateTime = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function daysLeft(purgeAt: string | null | undefined): string {
  const days = purgeAt ? Math.ceil((new Date(purgeAt).getTime() - Date.now()) / 86_400_000) : 0;
  if (days <= 0) return 'Deletes today';
  return days === 1 ? '1 day left' : `${days} days left`;
}

/** Runs one request at a time: a second submit while one is pending is dropped (F11). */
function useAction() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    try { await action(); }
    finally { pending.current = false; setBusy(false); }
  }, []);
  return { busy, run };
}

type Notice = { text: string; trashLink?: boolean; focus?: boolean };

function useResumeList(state: ListState) {
  const { session, refresh: refreshSession } = useSession();
  const userId = session?.user?.id ?? null;
  // Thumbnails are namespaced per user, so this route needs to know who is signed in.
  useEffect(() => { if (!session) void refreshSession().catch(() => {}); }, [session, refreshSession]);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [items, setItems] = useState<ResumeSummary[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const generation = useRef(0);

  const expired = useCallback((error: unknown) => {
    if (!(error instanceof ApiError) || error.status !== 401) return false;
    navigate(`/login?returnTo=${encodeURIComponent(pathname)}`, { replace: true });
    return true;
  }, [navigate, pathname]);

  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const page = await listResumes(state, null);
      if (current !== generation.current) return;
      setItems(page.items);
      setCursor(page.nextCursor);
      setLoadError('');
    } catch (error) {
      if (current !== generation.current || expired(error)) return;
      setLoadError(problemMessage(error));
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [expired, state]);

  useEffect(() => { void refresh(); }, [refresh]);

  // DD-P11-10: a complete list says which pages this device still needs; trashed ones cache again on demand.
  useEffect(() => {
    if (state === 'active' && !loading && !loadError && !cursor && userId) void pruneThumbnails(userId, new Set(items.map(item => item.id)));
  }, [state, loading, loadError, cursor, userId, items]);

  const appendNext = useCallback(async () => {
    const page = await listResumes(state, cursor);
    setItems(previous => [...previous, ...page.items]);
    setCursor(page.nextCursor);
  }, [cursor, state]);

  return { items, cursor, loading, loadError, refresh, appendNext, expired, userId };
}

/** The status region: one polite live element, focused after an action removes the control that had focus. */
function StatusRegion({ loading, notice }: { loading: boolean; notice: Notice | null }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!notice?.focus) return;
    // After the dialog's own focus return has run, or it would take the focus back to its opener.
    const timer = setTimeout(() => ref.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [notice]);
  return <p ref={ref} className="library-status" role="status" aria-atomic="true" tabIndex={-1}>
    {loading ? 'Loading resumes…' : notice?.text}
    {!loading && notice?.trashLink && <> <Link to="/resumes/trash">Open trash</Link></>}
  </p>;
}

function PageFrame({ actions, children }: { actions?: ReactNode; children: ReactNode }) {
  return <main id="main-content" className="library-main">
    <div className="library-head">
      <h1>Resumes</h1>
      {actions}
    </div>
    <nav className="view-tabs" aria-label="Resume views">
      <NavLink to="/resumes" end>My resumes</NavLink>
      <NavLink to="/resumes/trash">Trash</NavLink>
    </nav>
    {children}
  </main>;
}

function Skeleton() {
  return <div className="card-grid" aria-hidden="true"><SkeletonBlock className="h-70 rounded-2xl" /><SkeletonBlock className="h-70 rounded-2xl" /></div>;
}

function LoadFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="library-failure">
    <StatusNotice error>{message}</StatusNotice>
    <Button variant="secondary" type="button" onClick={onRetry}>Retry</Button>
  </div>;
}

function LoadMore({ list, onError }: { list: ReturnType<typeof useResumeList>; onError: (message: string) => void }) {
  const { busy, run } = useAction();
  if (!list.cursor) return null;
  const firstNew = list.items.length;
  return <div className="load-more">
    <Button variant="secondary" type="button" disabled={busy} onClick={() => void run(async () => {
      onError('');
      try {
        await list.appendNext();
        // The new cards exist after this render; the button itself may be gone (F02).
        setTimeout(() => document.querySelectorAll<HTMLElement>('main article')[firstNew]?.focus(), 0);
      } catch (error) {
        if (!list.expired(error)) onError(problemMessage(error));
      }
    })}>Load more</Button>
  </div>;
}

type Selected = { kind: 'create' } | { kind: 'delete' | 'purge'; item: ResumeSummary };

export function LibraryPage() {
  const list = useResumeList('active');
  const { userId } = list;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [failure, setFailure] = useState('');
  const [selected, setSelected] = useState<Selected | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const { run: runCopy } = useAction();
  const { run: runExport } = useAction();
  const verified = useEmailVerified();
  const [retryKeys] = useState(() => new RetryKeys());
  const close = () => setSelected(null);

  /** FR-LIB-06, DD-P12-15: the card holds no document, so the click fetches it and takes the editor's path. */
  const exportItem = (item: ResumeSummary, kind: 'PDF' | 'text file') => void runExport(async () => {
    if (!verified) return;
    setFailure('');
    setNotice(null);
    try {
      const resume = await getResume(item.id);
      if (!hasFullName(resume.document)) { setFailure(`Add a full name to "${displayTitle(item.title)}" to export it. Open it to edit the header.`); return; }
      const source = { resumeId: resume.id, document: resume.document, updatedAt: resume.updatedAt, photo: resume.photo };
      if (kind === 'PDF') setNotice({ text: pdfMessage(await exportPdf(source)) });
      else setNotice({ text: `Exported ${(await exportTxt(source, userId ? readLineEnding(userId) : 'lf')).fileName}.` });
    } catch (error) {
      if (list.expired(error)) return;
      setFailure(error instanceof ExportFailure ? failureMessage(error, kind) : libraryMessage(error));
      if (isStale(error)) await list.refresh();
    }
  });

  const copy = (item: ResumeSummary) => void runCopy(async () => {
    setFailure('');
    setNotice(null);
    const action = `copy:${item.id}`;
    try {
      const { key, body } = retryKeys.attempt(action, () => JSON.stringify(copyRequest(item)));
      await createResume(body, key);
      retryKeys.settle(action);
      setNotice({ text: 'Copied.' });
      await list.refresh();
    } catch (error) {
      retryKeys.settle(action, error);
      if (list.expired(error)) return;
      setFailure(isLimit(error) ? LIMIT_TEXT : libraryMessage(error));
      if (isStale(error)) await list.refresh();
    }
  });

  return <PageFrame actions={<div className="flex flex-wrap items-center gap-3"><Link className={buttonClass('secondary')} to="/resumes/import">Import CV</Link><Button type="button" onClick={() => setSelected({ kind: 'create' })}>Create new resume</Button></div>}>
    <StatusRegion loading={list.loading} notice={notice} />
    {list.loading && <Skeleton />}
    {failure && <StatusNotice error>{failure}</StatusNotice>}
    {list.loadError && <LoadFailure message={list.loadError} onRetry={() => void list.refresh()} />}
    {!verified && list.items.length > 0 && <p className="export-reason"><span id="library-export-reason">{VERIFY_REASON}</span> <Link to="/verify-email">Resend verification</Link></p>}
    {!list.loading && !list.loadError && list.items.length === 0 && <section className="empty-state">
      <h2>No resumes yet</h2>
      <Button type="button" onClick={() => setSelected({ kind: 'create' })}>Create your first resume</Button>
    </section>}
    <div className="card-grid">
      {list.items.map(item => {
        const title = displayTitle(item.title);
        return <article key={item.id} className="resume-card" tabIndex={-1}>
          <div className="card-title">
            {renaming === item.id
              ? <InlineRename item={item} onClose={() => setRenaming(null)} list={list} onRenamed={() => setNotice({ text: 'Renamed.' })} />
              : <h2 className={`wrap-text ${item.title ? '' : 'untitled'}`}><button type="button" className="card-title-edit" aria-label={`Rename ${title}`} title="Click to rename" onClick={() => setRenaming(item.id)}>{title}</button></h2>}
          </div>
          <p className="card-meta">Last modified {dateTime.format(new Date(item.updatedAt))}</p>
          <div className="card-field">
            <LibraryThumbnail item={item} userId={userId} />
            <div className="card-actions">
              <span className="sr-only">Template {item.templateId}</span>
              <Link className={buttonClass()} to={`/resumes/${item.id}/edit`} aria-label={`Open ${title}`}>Open</Link>
              <Button variant="secondary" type="button" aria-label={`Copy ${title}`} onClick={() => copy(item)}>Copy</Button>
              <Button variant="secondary" type="button" aria-label={`Delete ${title}`} onClick={() => setSelected({ kind: 'delete', item })}>Delete</Button>
              <Button variant="secondary" type="button" aria-label={`Export PDF ${title}`} aria-disabled={!verified} aria-describedby={verified ? undefined : 'library-export-reason'} onClick={() => exportItem(item, 'PDF')}>Export PDF</Button>
              <Button variant="secondary" type="button" aria-label={`Export TXT ${title}`} aria-disabled={!verified} aria-describedby={verified ? undefined : 'library-export-reason'} onClick={() => exportItem(item, 'text file')}>Export TXT</Button>
            </div>
          </div>
        </article>;
      })}
    </div>
    <LoadMore list={list} onError={setFailure} />
    {selected?.kind === 'create' && <CreateDialog items={list.items} retryKeys={retryKeys} onClose={close} expired={list.expired} onUnknownOutcome={() => void list.refresh()} />}
    {selected?.kind === 'delete' && <ConfirmDialog
      title="Delete resume?"
      confirmLabel="Move to trash"
      text="It moves to the trash, and you can restore it from there for 30 days."
      action={key => trashResume(selected.item.id, selected.item.version, key)}
      onClose={close}
      list={list}
      onDone={() => setNotice({ text: 'Moved to trash.', trashLink: true, focus: true })}
      onStale={setFailure}
    />}
  </PageFrame>;
}

export function TrashPage() {
  const list = useResumeList('trashed');
  const { userId } = list;
  const [notice, setNotice] = useState<Notice | null>(null);
  const [failure, setFailure] = useState('');
  const [selected, setSelected] = useState<Selected | null>(null);
  const { run: runRestore } = useAction();
  const [retryKeys] = useState(() => new RetryKeys());

  const restore = (item: ResumeSummary) => void runRestore(async () => {
    setFailure('');
    setNotice(null);
    const action = `restore:${item.id}`;
    try {
      await restoreResume(item.id, item.version, retryKeys.attempt(action).key);
      retryKeys.settle(action);
      setNotice({ text: 'Restored.', focus: true });
      await list.refresh();
    } catch (error) {
      retryKeys.settle(action, error);
      if (list.expired(error)) return;
      setFailure(libraryMessage(error));
      if (isStale(error)) await list.refresh();
    }
  });

  return <PageFrame>
    <StatusRegion loading={list.loading} notice={notice} />
    {list.loading && <Skeleton />}
    {failure && <StatusNotice error>{failure}</StatusNotice>}
    {list.loadError && <LoadFailure message={list.loadError} onRetry={() => void list.refresh()} />}
    {!list.loading && !list.loadError && list.items.length === 0 && <section className="empty-state"><h2>Trash is empty</h2></section>}
    <div className="card-grid">
      {list.items.map(item => {
        const title = displayTitle(item.title);
        return <article key={item.id} className="resume-card" tabIndex={-1}>
          <h2 className={`wrap-text ${item.title ? '' : 'untitled'}`}>{title}</h2>
          <p className="card-meta">Deleted {item.deletedAt ? date.format(new Date(item.deletedAt)) : ''}</p>
          <p className="card-meta days-left">{daysLeft(item.purgeAt)}</p>
          <div className="card-field">
            <LibraryThumbnail item={item} userId={userId} />
            <div className="card-actions">
              <span className="sr-only">Template {item.templateId}</span>
              <Button variant="secondary" type="button" aria-label={`Restore ${title}`} onClick={() => restore(item)}>Restore</Button>
              <Button variant="secondary" type="button" aria-label={`Delete permanently ${title}`} onClick={() => setSelected({ kind: 'purge', item })}>Delete permanently</Button>
            </div>
          </div>
        </article>;
      })}
    </div>
    <LoadMore list={list} onError={setFailure} />
    {selected?.kind === 'purge' && <ConfirmDialog
      title="Delete permanently?"
      confirmLabel="Delete permanently"
      text="This resume, its photo and its history are removed for good. This cannot be undone."
      action={key => purgeResume(selected.item.id, selected.item.version, key)}
      onClose={() => setSelected(null)}
      list={list}
      onDone={() => setNotice({ text: 'Deleted permanently.', focus: true })}
      onStale={setFailure}
    />}
  </PageFrame>;
}

const LIMIT_TEXT = 'You have reached the limit of 200 resumes, counting the trash. Delete some from the trash to make room.';

function ConfirmDialog({ title, confirmLabel, text, action, onClose, list, onDone, onStale }: {
  title: string; confirmLabel: string; text: string; action: (key: string) => Promise<unknown>; onClose: () => void;
  list: ReturnType<typeof useResumeList>; onDone: () => void; onStale: (message: string) => void;
}) {
  const { busy, run } = useAction();
  const [error, setError] = useState('');
  const [retryKeys] = useState(() => new RetryKeys());
  const confirm = () => void run(async () => {
    setError('');
    try {
      await action(retryKeys.attempt('confirm').key);
      onClose();
      onDone();
      await list.refresh();
    } catch (failure) {
      retryKeys.settle('confirm', failure);
      if (list.expired(failure)) return;
      if (isStale(failure)) {
        onClose();
        onStale(libraryMessage(failure));
        await list.refresh();
        return;
      }
      setError(libraryMessage(failure));
    }
  });
  return <Dialog title={title} onClose={onClose} busy={busy}>
    <p>{text}</p>
    {error && <StatusNotice error>{error}</StatusNotice>}
    <div className="dialog-actions">
      <Button variant="secondary" type="button" data-initial-focus disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="danger" type="button" disabled={busy} onClick={confirm}>{confirmLabel}</Button>
    </div>
  </Dialog>;
}

const copyRequest = (item: ResumeSummary): CreateResumeRequest => ({ source: 'copy', sourceResumeId: item.id, title: copyTitle(item.title) });

/** `retryKeys` belongs to the page: closing the dialog must not forget an attempt whose outcome is unknown. */
function CreateDialog({ items, retryKeys, onClose, expired, onUnknownOutcome }: {
  items: ResumeSummary[]; retryKeys: RetryKeys; onClose: () => void; expired: (error: unknown) => boolean; onUnknownOutcome: () => void;
}) {
  const navigate = useNavigate();
  const { busy, run } = useAction();
  const [choice, setChoice] = useState('');
  const [error, setError] = useState('');
  const [limited, setLimited] = useState(false);

  const submit = (action: string, build: () => CreateResumeRequest) => void run(async () => {
    setError('');
    setLimited(false);
    try {
      const { key, body } = retryKeys.attempt(action, () => JSON.stringify(build()));
      const created = await createResume(body, key);
      retryKeys.settle(action);
      navigate(`/resumes/${created.id}/edit`);
    } catch (failure) {
      retryKeys.settle(action, failure);
      if (expired(failure)) return;
      // The first request may have created the resume, so show what the server holds now.
      if (!provesNothingWritten(failure)) onUnknownOutcome();
      if (isLimit(failure)) setLimited(true);
      else setError(libraryMessage(failure));
    }
  });
  const selected = items.find(item => item.id === choice);

  return <Dialog title="Create a resume" onClose={onClose} busy={busy}>
    <p>{items.length ? 'Start from scratch, or copy one of your resumes.' : 'Start from a blank resume.'}</p>
    {items.length > 0 && <fieldset className="resume-choices">
      <legend>Copy one of your resumes</legend>
      {items.map(item => <label key={item.id}>
        <input type="radio" name="copy-source" value={item.id} checked={choice === item.id} onChange={() => setChoice(item.id)} />
        <span className="wrap-text">{displayTitle(item.title)}<small>Last modified {date.format(new Date(item.updatedAt))}</small></span>
      </label>)}
    </fieldset>}
    {limited && <StatusNotice error>{LIMIT_TEXT} <Link to="/resumes/trash">Go to the trash</Link></StatusNotice>}
    {error && <StatusNotice error>{error}</StatusNotice>}
    <div className="dialog-actions">
      <Button variant="secondary" type="button" data-initial-focus disabled={busy} onClick={onClose}>Cancel</Button>
      <Button variant="secondary" type="button" disabled={busy} onClick={() => submit('scratch', () => ({ source: 'document', document: blankResumeDocument(), copyPhotoFromResumeId: null }))}>Start from scratch</Button>
      {items.length > 0 && <Button type="button" disabled={busy || !selected} onClick={() => selected && submit(`copy:${selected.id}`, () => copyRequest(selected))}>Copy selected</Button>}
    </div>
  </Dialog>;
}

function InlineRename({ item, onClose, list, onRenamed }: { item: ResumeSummary; onClose: () => void; list: ReturnType<typeof useResumeList>; onRenamed: () => void }) {
  const { busy, run } = useAction();
  const [resume, setResume] = useState<Resume | null>(null);
  const [title, setTitle] = useState(item.title);
  const [error, setError] = useState('');
  const field = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ key: string; body: string } | null>(null);
  const { expired } = list;

  useEffect(() => {
    let current = true;
    getResume(item.id).then(loaded => {
      if (!current) return;
      setResume(loaded);
    }).catch((failure: unknown) => {
      if (current && !expired(failure)) setError(libraryMessage(failure));
    });
    return () => { current = false; };
  }, [expired, item.id]);

  const loaded = resume !== null;
  const pending = useRef(false);
  useEffect(() => { field.current?.select(); }, []);
  useEffect(() => {
    if (!loaded) return;
    // A save asked for before the document arrived runs as soon as it does.
    if (pending.current) submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const length = titleLength(title);
  const tooLong = length > TITLE_LIMIT;

  function submit(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    if (title === item.title && !error) { onClose(); return; }
    if (tooLong) return;
    if (!resume) { pending.current = true; return; }
    pending.current = false;
    void run(async () => {
      setError('');
      const body = JSON.stringify({ ...resume.document, title });
      if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body };
      try {
        await replaceDocument(resume.id, resume.version, attempt.current.body, attempt.current.key);
        onClose();
        onRenamed();
        await list.refresh();
      } catch (failure) {
        if (provesNothingWritten(failure)) attempt.current = null;
        if (expired(failure)) return;
        setError(libraryMessage(failure));
        if (isStale(failure)) {
          await list.refresh();
          // The next try must carry the version the conflict revealed, not the stale one.
          try { setResume(await getResume(item.id)); }
          catch (reload) { if (!expired(reload)) setError(libraryMessage(reload)); }
        }
      }
    });
  }

  return <form noValidate className="card-rename-form" onSubmit={submit} aria-busy={busy}>
    <Input ref={field} id={`resume-title-${item.id}`} name="title" aria-label="Name" value={title} spellCheck autoFocus disabled={busy} className={CONTROL}
      aria-invalid={tooLong} aria-describedby={tooLong ? `resume-title-${item.id}-error` : undefined}
      onChange={event => setTitle(event.target.value)}
      onBlur={() => { if (!error) submit(); }}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); } }} />
    {tooLong && <FieldError id={`resume-title-${item.id}-error`}>{`${length} of ${TITLE_LIMIT} characters. Shorten the name.`}</FieldError>}
    {error && <StatusNotice error>{error}</StatusNotice>}
  </form>;
}
