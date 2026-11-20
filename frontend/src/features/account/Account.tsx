import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, apiRequest, jsonBody, type AccountSchemas } from '../../shared/api/client';
import { AppFrame, Button, Dialog, StatusNotice, Surface, PasswordField, TextField } from '../../shared/ui';
import { useFormValidation, useSubmission } from './forms';
import { useSession } from './session';
export { Account } from './AccountSettings';

function AuthPage({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [title]);
  return <main id="main-content" className="auth-main">
    <AppFrame>
      <aside className="auth-story" aria-hidden="true">
        <div className="story-shape" />
        <p>Resumiser</p><h2>A clearer way to tell your story.</h2>
      </aside>
      <Surface className="auth-surface items-center justify-center rounded-none p-6 shadow-none ring-0 sm:p-8 lg:p-12"><div className="auth-content">
        <p className="eyebrow">Your account</p>
        <h1 ref={heading} tabIndex={-1}>{title}</h1>
        <p className="auth-intro">{intro}</p>
        {children}
      </div></Surface>
    </AppFrame>
  </main>;
}

export function SignUp() {
  const navigate = useNavigate();
  const submission = useSubmission();
  const validation = useFormValidation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    submission.clearErrors();
    submission.setStatus('');
    if (!validation.validate(event, { email, password }, true)) return;
    const request = { email, password } satisfies AccountSchemas['SignUpRequest'];
    setPassword('');
    await submission.run(async () => {
      await apiRequest('/auth/sign-up', jsonBody(request));
      navigate('/verify-email');
    });
    setPassword('');
  }
  return <AuthPage title="Create account" intro="Start with an address you can access.">
    <form noValidate onSubmit={submit} aria-busy={submission.busy}>
      <TextField id="signup-email" name="email" label="Email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} error={validation.errors.email} required />
      <PasswordField id="signup-password" name="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} error={validation.errors.password || submission.fieldErrors.password} help="Use 10–128 characters. Avoid common phrases." required />
      {Object.keys(validation.errors).length > 0 && <StatusNotice error>Check the highlighted fields and try again.</StatusNotice>}
      {submission.error && <StatusNotice error>{submission.error}</StatusNotice>}
      <Button disabled={submission.busy}>{submission.busy ? 'Creating account…' : 'Create account'}</Button>
    </form>
    <p className="form-footer">Already registered? <Link to="/login">Log in</Link></p>
  </AuthPage>;
}

function safeReturnPath(value: string | null) {
  // DD-P07-17: the library is the default landing, and an unsafe return path falls back to it.
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/resumes';
  const destination = new URL(value, window.location.origin);
  return destination.origin === window.location.origin && /^\/(account|resumes(?:\/trash|\/[^/]+\/edit)?)$/.test(destination.pathname)
    ? destination.pathname : '/resumes';
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refresh } = useSession();
  const submission = useSubmission();
  const validation = useFormValidation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const notice = location.state?.accountNotice === 'password-reset' ? 'Password reset. Log in with your new password.' : '';
  async function submit(event: FormEvent<HTMLFormElement>) {
    submission.clearErrors();
    submission.setStatus('');
    if (!validation.validate(event, { email, password })) return;
    const request = { email, password } satisfies AccountSchemas['LoginRequest'];
    setPassword('');
    await submission.run(async () => {
      await apiRequest('/auth/login', jsonBody(request));
      await refresh(true);
      navigate(safeReturnPath(new URLSearchParams(location.search).get('returnTo')), { replace: true });
    });
    setPassword('');
  }
  return <AuthPage title="Log in" intro="Welcome back. Continue with your account.">
    {notice && <StatusNotice>{notice}</StatusNotice>}
    <form noValidate onSubmit={submit} aria-busy={submission.busy}>
      <TextField id="login-email" name="email" label="Email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} error={validation.errors.email} required />
      <PasswordField id="login-password" name="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} error={validation.errors.password || submission.fieldErrors.password} required />
      {Object.keys(validation.errors).length > 0 && <StatusNotice error>Check the highlighted fields and try again.</StatusNotice>}
      {submission.error && <StatusNotice error>{submission.error}</StatusNotice>}
      <Button disabled={submission.busy}>{submission.busy ? 'Logging in…' : 'Log in'}</Button>
    </form>
    <p className="form-footer"><Link to="/reset-password">Forgot your login?</Link> · <Link to="/sign-up">Create account</Link></p>
  </AuthPage>;
}

function readFragment() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const token = params.get('t') || params.get('token');
  if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
  let meta = document.querySelector<HTMLMetaElement>('meta[name="referrer"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'referrer'; document.head.append(meta); }
  meta.content = 'no-referrer';
  return token;
}

function useFragment() {
  const [link, setLink] = useState(() => ({ token: readFragment(), version: 0 }));
  const clear = useCallback(() => setLink(current => ({ ...current, token: null })), []);
  useEffect(() => {
    const changed = () => setLink(current => ({ token: readFragment(), version: current.version + 1 }));
    window.addEventListener('hashchange', changed);
    return () => window.removeEventListener('hashchange', changed);
  }, []);
  return { ...link, clear };
}

export function VerifyEmail() {
  const { token, version, clear } = useFragment();
  const { refresh } = useSession();
  const submission = useSubmission();
  const { run, setStatus } = submission;
  const validation = useFormValidation();
  const processed = useRef<number | null>(null);
  const [email, setEmail] = useState('');
  useEffect(() => {
    if (!token || processed.current === version) return;
    processed.current = version;
    void run(async () => {
      try {
        await apiRequest('/auth/verify-email', jsonBody({ token } satisfies AccountSchemas['VerifyEmailRequest']));
        await refresh(true);
        setStatus('Email verified. You can log in.');
      } finally { clear(); }
    });
  }, [token, version, clear, run, refresh, setStatus]);
  async function resend(event: FormEvent<HTMLFormElement>) {
    submission.clearErrors();
    submission.setStatus('');
    if (!validation.validate(event, { email })) return;
    await run(async () => {
      await apiRequest('/auth/resend-verification', jsonBody({ email } satisfies AccountSchemas['ResendVerificationRequest']));
      setStatus('Verification request received. Check your email.');
    });
  }
  return <AuthPage title="Verify email" intro="Open the link we sent you.">
    {submission.busy && <StatusNotice>Working…</StatusNotice>}
    {submission.status && <StatusNotice>{submission.status}</StatusNotice>}
    {submission.error && <StatusNotice error>{submission.error}</StatusNotice>}
    <form noValidate onSubmit={resend} aria-busy={submission.busy}>
      <TextField id="verify-email" name="email" label="Email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} error={validation.errors.email} required />
      {validation.errors.email && <StatusNotice error>Check the highlighted field and try again.</StatusNotice>}
      <Button disabled={submission.busy}>Resend verification</Button>
    </form>
    <p className="form-footer"><Link to="/login">Log in</Link></p>
  </AuthPage>;
}

export function ResetPassword({ confirm = false }: { confirm?: boolean }) {
  const { token, clear } = useFragment();
  const { clear: clearSession, refresh } = useSession();
  const navigate = useNavigate();
  const submission = useSubmission();
  const validation = useFormValidation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    submission.clearErrors();
    submission.setStatus('');
    if (!validation.validate(event, confirm ? { newPassword: password } : { email })) return;
    if (confirm && !token) { submission.setError('This link is invalid or expired. Request a new one.'); return; }
    const newPassword = password;
    setPassword('');
    await submission.run(async () => {
      if (confirm && token) {
        try {
          await apiRequest('/auth/password-reset/confirm', jsonBody({ token, newPassword } satisfies AccountSchemas['PasswordResetConfirmRequest']));
          clear();
          clearSession();
          await refresh(true);
          navigate('/login', { replace: true, state: { accountNotice: 'password-reset' } });
        } catch (error) {
          if (error instanceof ApiError && error.problem?.code === 'token_invalid') clear();
          throw error;
        }
      } else {
        await apiRequest('/auth/password-reset/request', jsonBody({ email } satisfies AccountSchemas['PasswordResetRequest']));
        submission.setStatus('Request received. Check your email.');
      }
    });
    setPassword('');
  }
  return <AuthPage title="Reset password" intro={confirm ? 'Choose a new password.' : 'We will send a reset link if the address has an account.'}>
    <form noValidate onSubmit={submit} aria-busy={submission.busy}>
      {confirm
        ? <PasswordField id="reset-password" name="newPassword" label="New password" autoComplete="new-password" help="Use 10–128 characters." value={password} onChange={event => setPassword(event.target.value)} error={validation.errors.newPassword || submission.fieldErrors.newPassword} required />
        : <TextField id="reset-email" name="email" label="Email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} error={validation.errors.email} required />}
      {Object.keys(validation.errors).length > 0 && <StatusNotice error>Check the highlighted fields and try again.</StatusNotice>}
      {submission.error && <StatusNotice error>{submission.error}</StatusNotice>}
      {submission.status && <StatusNotice>{submission.status}</StatusNotice>}
      <Button disabled={submission.busy}>{submission.busy ? 'Sending…' : confirm ? 'Set new password' : 'Request reset link'}</Button>
    </form>
    <p className="form-footer">{confirm && <><Link to="/reset-password">Request a new link</Link> · </>}<Link to="/login">Log in</Link></p>
  </AuthPage>;
}

export function ClaimDraft({ summary, onSave, onDiscard, onLater }: { summary?: string; onSave: () => void; onDiscard: () => void; onLater: () => void }) {
  if (!summary) return null;
  return <Dialog title="Save your draft?" onClose={onLater}>
    <p className="wrap-text">{summary}</p>
    <div className="dialog-actions">
      <Button variant="secondary" onClick={onLater} data-initial-focus>Later</Button>
      <Button variant="secondary" onClick={onDiscard}>Discard draft</Button>
      <Button onClick={onSave}>Save draft to account</Button>
    </div>
  </Dialog>;
}
