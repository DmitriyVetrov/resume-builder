import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, apiRequest, jsonBody, type AccountSchemas } from '../../shared/api/client';
import { Badge, Button, Dialog, LoadingSkeleton, PasswordField, Progress, StatusNotice, Surface } from '../../shared/ui';
import { localDataSummary, removeLocalData } from '../../entities/resume/local-data';
import { saveFile } from '../export/download';
import { buildArchive, failedPdfs, type ArchiveProgress } from './archive';
import { useFormValidation, useSubmission } from './forms';
import { useSession } from './session';

type AccountAction = 'delete' | 'export' | 'password';

const resumesLabel = (count: number) => `${count} resume${count === 1 ? '' : 's'}`;
/** DD-P13-13: the result in one sentence, naming any PDF the archive lists as missing. */
function archiveMessage(fileName: string, failed: number) {
  const missing = failed === 0 ? '' : ` ${failed} PDF${failed === 1 ? '' : 's'} could not be created and ${failed === 1 ? 'is' : 'are'} listed in manifest.json.`;
  return `Downloaded ${fileName}.${missing}`;
}

export function Account() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeSection = ['#security', '#data'].includes(location.hash) ? location.hash.slice(1) : 'profile';
  const finalCancel = useRef<HTMLButtonElement>(null);
  const { session, loading, error: sessionError, refresh, clear, retry } = useSession();
  const submission = useSubmission();
  const validation = useFormValidation();
  const [action, setAction] = useState<AccountAction | null>(null);
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [status, setStatus] = useState('');
  const [localData, setLocalData] = useState<{ unsynced: boolean } | null>(null);
  const [archive, setArchive] = useState<ArchiveProgress | null>(null);
  const archiveRun = useRef<AbortController | null>(null);
  const cancelArchive = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const signedIn = session?.authenticated === true && !!session.user;
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { if (deleteConfirmed) finalCancel.current?.focus(); }, [deleteConfirmed]);
  const preparing = archive !== null;
  useEffect(() => { if (preparing) cancelArchive.current?.focus(); }, [preparing]);
  useEffect(() => () => archiveRun.current?.abort(), []);

  function open(next: AccountAction) {
    if (!signedIn || submission.busy) return;
    setAction(next);
    setPassword('');
    setNewPassword('');
    setDeleteConfirmed(false);
    validation.setErrors({});
    submission.clearErrors();
    setStatus('');
  }

  function close() {
    if (submission.busy) return;
    setAction(null);
    setPassword('');
    setNewPassword('');
    setDeleteConfirmed(false);
    validation.setErrors({});
    submission.clearErrors();
  }

  async function accountRequest(operation: () => Promise<void>) {
    await submission.run(async () => {
      try { await operation(); }
      catch (error) {
        if (error instanceof ApiError && error.status === 401 && error.problem?.code !== 'reauthentication_required') {
          clear();
          navigate('/login?returnTo=/account', { replace: true });
        }
        if (error instanceof ApiError && error.problem?.code === 'reauthentication_required') setDeleteConfirmed(false);
        throw error;
      }
    });
  }

  async function sensitive(event: FormEvent<HTMLFormElement>) {
    submission.clearErrors();
    const fields = action === 'password' ? { password, newPassword } : { password };
    if (!validation.validate(event, fields)) return;
    const currentPassword = password;
    const nextPassword = newPassword;
    setPassword('');
    setNewPassword('');
    await accountRequest(async () => {
      await apiRequest('/auth/reauthenticate', jsonBody({ password: currentPassword } satisfies AccountSchemas['ReauthenticateRequest']));
      if (action === 'delete') {
        setDeleteConfirmed(true);
        return;
      }
      if (action === 'password') {
        await apiRequest('/account/password', {
          method: 'PUT', body: JSON.stringify({ newPassword: nextPassword } satisfies AccountSchemas['ChangePasswordRequest']),
        });
        clear();
        await refresh(true);
        setAction(null);
        navigate('/login', { replace: true });
        return;
      }
      setAction(null);
      await downloadArchive();
    });
    setPassword('');
    setNewPassword('');
  }

  /** FR-ACC-04: one ZIP, built here one resume at a time; Cancel downloads nothing (DD-P13-13). */
  async function downloadArchive() {
    const run = new AbortController();
    archiveRun.current = run;
    setArchive({ done: 0, total: 0 });
    try {
      const result = await buildArchive({ signal: run.signal, onProgress: setArchive });
      saveFile(result.blob, result.fileName, 'application/zip');
      setStatus(archiveMessage(result.fileName, failedPdfs(result.manifest)));
    } catch (error) {
      if (!run.signal.aborted) throw error;
      setStatus('Archive cancelled. Nothing was downloaded.');
    } finally {
      archiveRun.current = null;
      setArchive(null);
    }
  }

  async function deleteAccount() {
    if (!deleteConfirmed) return;
    await accountRequest(async () => {
      await apiRequest('/account', { method: 'DELETE' });
      // Thumbnails hold resume text (DD-P11-10), and nobody can ask to remove them after this.
      if (session?.user?.id) await removeLocalData(session.user.id).catch(() => {});
      clear();
      setAction(null);
      navigate('/login', { replace: true });
    });
  }

  async function logout(removeData = false) {
    const userId = session?.user?.id;
    if (removeData && userId) await removeLocalData(userId);
    await accountRequest(async () => {
      await apiRequest('/auth/logout', { method: 'POST' });
      clear();
      await refresh(true);
      navigate('/login', { replace: true });
    });
  }

  /** T-ID-06: a device with this user's local data offers removal; otherwise logging out stays one click. */
  async function startLogout() {
    const userId = session?.user?.id;
    const summary = userId ? await localDataSummary(userId) : null;
    if (summary?.hasData) setLocalData(summary);
    else await logout();
  }

  return <main id="main-content" className="account-main">
    <h1 ref={heading} tabIndex={-1}>Account settings</h1>
    {loading ? <LoadingSkeleton /> : sessionError ? <Surface>
      <StatusNotice error>Account unavailable. Retry loading.</StatusNotice>
      <Button onClick={retry}>Retry</Button>
    </Surface> : !signedIn ? <Surface>
      <p>Sign in to manage your account.</p>
      <Link to="/login?returnTo=/account">Log in</Link>
    </Surface> : <div className="settings-layout">
      <nav aria-label="Account settings" className="settings-nav">
        <ul>{[['profile', 'Profile'], ['security', 'Security'], ['data', 'Your data']].map(([id, label]) =>
          <li key={id}><a href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined}>{label}</a></li>
        )}</ul>
      </nav>
      <div className="settings-content">
        {submission.error && !action && <StatusNotice error>{submission.error}</StatusNotice>}
        <Surface>
          <h2 id="profile" tabIndex={-1}>Profile</h2>
          <p className="wrap-text">{session.user?.email}</p>
          <Badge>{session.user?.emailVerified ? 'Verified' : 'Email not verified'}</Badge>
          {!session.user?.emailVerified && <p><Link to="/verify-email">Resend verification</Link></p>}
        </Surface>
        <Surface>
          <h2 id="security" tabIndex={-1}>Security</h2>
          <p>Confirm your current password before choosing a new one.</p>
          <Button variant="secondary" onClick={() => open('password')}>Change password</Button>
        </Surface>
        <Surface>
          <h2 id="data" tabIndex={-1}>Your data</h2>
          <p>Download everything in your account as one ZIP file: your account details and every resume, including the trash, as JSON, PDF and TXT, with your photos.</p>
          <Button variant="secondary" disabled={!session.user?.emailVerified || preparing} aria-describedby={!session.user?.emailVerified ? 'export-help' : undefined} onClick={() => open('export')}>Download your data</Button>
          {!session.user?.emailVerified && <p id="export-help">Verify your email before downloading your data.</p>}
          {archive && <div className="flex flex-col gap-3">
            <StatusNotice>Preparing your archive: {archive.done} of {resumesLabel(archive.total)}</StatusNotice>
            <Progress aria-label="Archive progress" value={archive.total ? Math.round(archive.done / archive.total * 100) : 0} />
            <div><Button variant="secondary" ref={cancelArchive} onClick={() => archiveRun.current?.abort()}>Cancel</Button></div>
          </div>}
          {status && !archive && <StatusNotice>{status}</StatusNotice>}
          <div className="danger-zone">
            <h2>Danger zone</h2>
            <p>Request deletion of your account and live data within 24 hours.</p>
            <Button variant="danger" onClick={() => open('delete')}>Delete account</Button>
          </div>
        </Surface>
        <Button variant="secondary" disabled={submission.busy} onClick={() => void startLogout()}>Log out</Button>
      </div>
    </div>}
    {localData && <Dialog title="Local data on this device" onClose={() => setLocalData(null)} busy={submission.busy}>
      <p>This device keeps resume data for your account. Remove it if other people use this device.</p>
      {localData.unsynced && <StatusNotice error>Some of your changes have not been saved to your account yet. Removing the local data deletes them.</StatusNotice>}
      <div className="dialog-actions">
        <Button variant="secondary" data-initial-focus disabled={submission.busy} onClick={() => setLocalData(null)}>Cancel</Button>
        <Button variant="secondary" disabled={submission.busy} onClick={() => { setLocalData(null); void logout(); }}>Keep and log out</Button>
        <Button variant="danger" disabled={submission.busy} onClick={() => { setLocalData(null); void logout(true); }}>Remove and log out</Button>
      </div>
    </Dialog>}
    {action && <Dialog title={action === 'delete' ? 'Delete account' : action === 'export' ? 'Re-authenticate to download your data' : 'Re-authenticate to change password'} onClose={close} busy={submission.busy}>
      {deleteConfirmed ? <>
        <StatusNotice>Your password is confirmed. Confirm deletion within five minutes.</StatusNotice>
        <p>Deleting your account signs you out immediately. Live account data is removed within 24 hours. This cannot be undone.</p>
        {submission.error && <StatusNotice error>{submission.error}</StatusNotice>}
        <div className="dialog-actions">
          <Button type="button" variant="secondary" disabled={submission.busy} onClick={close} ref={finalCancel} data-initial-focus>Cancel</Button>
          <Button type="button" variant="danger" disabled={submission.busy} onClick={deleteAccount}>{submission.busy ? 'Requesting deletion…' : 'Delete account'}</Button>
        </div>
      </> : <form noValidate onSubmit={sensitive} aria-busy={submission.busy}>
        <p>{action === 'delete' ? 'First confirm your password. You will review the deletion request next.' : 'Confirm your password to continue.'}</p>
        <PasswordField id="reauth-password" name="password" label="Current password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} error={validation.errors.password || submission.fieldErrors.password} required />
        {action === 'password' && <PasswordField id="new-password" name="newPassword" label="New password" autoComplete="new-password" help="Use 10–128 characters." value={newPassword} onChange={event => setNewPassword(event.target.value)} error={validation.errors.newPassword || submission.fieldErrors.newPassword} required />}
        {Object.keys(validation.errors).length > 0 && <StatusNotice error>Check the highlighted fields and try again.</StatusNotice>}
        {submission.error && <StatusNotice error>{submission.error}</StatusNotice>}
        <div className="dialog-actions">
          <Button type="button" variant="secondary" disabled={submission.busy} onClick={close} data-initial-focus>Cancel</Button>
          <Button disabled={submission.busy}>{submission.busy ? 'Confirming…' : 'Confirm'}</Button>
        </div>
      </form>}
    </Dialog>}
  </main>;
}
