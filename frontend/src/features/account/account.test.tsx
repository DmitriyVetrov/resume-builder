import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../app/App';
import { readThumbnail, writeThumbnail } from '../../entities/resume/local-data';
import { ClaimDraft } from './Account';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const signedIn = { authenticated: true, user: { id: '00000000-0000-4000-8000-000000000001', email: 'person-a@example.invalid', emailVerified: true, createdAt: '2026-11-03T12:00:00Z' } };
const unverified = { ...signedIn, user: { ...signedIn.user, emailVerified: false } };
const passwordProblem = (pointer: '/password' | '/newPassword', code: string) =>
  new Response(JSON.stringify({ type: 'about:blank', title: 'Validation failed', status: 400, code: 'validation_failed', traceId: 'synthetic-trace',
    errors: [{ location: 'body', pointer, code }] }), { status: 400, headers: { 'Content-Type': 'application/problem+json' } });

beforeEach(() => { window.history.replaceState({}, '', '/'); });
afterEach(() => vi.unstubAllGlobals());

describe('P06 account routes', () => {
  const cases = [
    ['/auth/sign-up', /sign up|create account/i, /email/i],
    ['/auth/login', /log in|sign in/i, /password/i],
    ['/auth/password-reset', /reset password/i, /email/i],
    ['/auth/verify-email', /verify email/i, /verification/i],
    ['/account', /account/i, /delete account/i],
  ] as const;
  it.each(cases)('%s has a named account action', async (path, heading, control) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(signedIn), { status: 200 })));
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(await screen.findByText(control)).toBeVisible();
  });
  it('does not offer Google sign-in', () => {
    window.history.replaceState({}, '', '/auth/login');
    render(<App />);
    expect(screen.queryByRole('button', { name: /google/i })).not.toBeInTheDocument();
  });
});

describe('P06 visual and accessibility account surface', () => {
  it('login has associated labels and one primary action', () => {
    window.history.replaceState({}, '', '/login');
    render(<App />);
    expect(screen.getByRole('heading', { name: /log in/i })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeVisible();
    expect(screen.getByLabelText(/password/i)).toBeVisible();
    expect(screen.getByRole('button', { name: /log in/i })).toBeVisible();
  });
  it('reset has a labelled address and recovery action', () => {
    window.history.replaceState({}, '', '/reset-password');
    render(<App />);
    expect(screen.getByRole('heading', { name: /reset password/i })).toBeVisible();
    expect(screen.getByRole('textbox', { name: /email/i })).toBeVisible();
    expect(screen.getByRole('button', { name: /request|send/i })).toBeVisible();
  });
});

describe('P06 canonical account routes', () => {
  it.each([
    ['/sign-up', /sign up|create account/i],
    ['/login', /log in|sign in/i],
    ['/reset-password', /reset password/i],
    ['/verify-email', /verify email/i],
    ['/reset-password/confirm', /reset password/i],
  ])('%s renders its account view', (path, heading) => {
    window.history.replaceState({}, '', path);
    render(<App />);
    expect(screen.getByRole('heading', { name: heading })).toBeVisible();
  });

  it.each([
    ['/auth/sign-up', '/sign-up'],
    ['/auth/login', '/login'],
    ['/auth/password-reset', '/reset-password'],
    ['/auth/verify-email', '/verify-email'],
    ['/auth/password-reset/confirm', '/reset-password/confirm'],
  ])('%s replaces history with %s', (alias, canonical) => {
    window.history.replaceState({}, '', alias);
    render(<App />);
    expect(window.location.pathname).toBe(canonical);
  });

  it.each(['/verify-email', '/auth/verify-email', '/reset-password/confirm', '/auth/password-reset/confirm'])('%s clears either token fragment before interaction', (path) => {
      for (const fragment of ['#t=synthetic-marker', '#token=synthetic-marker']) {
        window.history.replaceState({}, '', path + fragment);
        const view = render(<App />);
        expect(window.location.hash).toBe('');
        view.unmount();
      }
    });
});

describe('P06 account interaction and recovery', () => {
  it('signup labels fields and keeps the password out of a generic error', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ type: 'about:blank', title: 'Invalid input', status: 400, code: 'validation_failed', traceId: 'synthetic-trace' }), { status: 400, headers: { 'Content-Type': 'application/problem+json' } }));
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/sign-up');
    render(<App />);
    const email = screen.getByRole('textbox', { name: /email/i });
    const password = screen.getByLabelText(/^password/i);
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(password).toHaveAttribute('autocomplete', 'new-password');
    fireEvent.change(email, { target: { value: 'person-a@example.invalid' } });
    fireEvent.change(password, { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account|sign up/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    expect(screen.getByRole('alert').textContent).not.toContain('synthetic-secret-123');
  });

  it('login error is recoverable and announced without submitted values', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ type: 'about:blank', title: 'Invalid credentials', status: 401, code: 'invalid_credentials', traceId: 'synthetic-trace' }), { status: 401, headers: { 'Content-Type': 'application/problem+json' } })));
    window.history.replaceState({}, '', '/login');
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'person-a@example.invalid' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/invalid|try again/i));
    expect(screen.getByRole('alert').textContent).not.toContain('person-a@example.invalid');
    expect(screen.getByRole('alert').textContent).not.toContain('synthetic-secret-123');
    expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled();
  });

  it('deletion cancel restores focus and sends no request', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('/session');
      return new Response(JSON.stringify(signedIn), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    window.history.replaceState({}, '', '/account');
    render(<App />);
    const trigger = await screen.findByRole('button', { name: /delete account/i });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: /delete account/i });
    expect(dialog).toBeVisible();
    expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(fetchMock.mock.calls.every(call => String(call[0]).includes('/session'))).toBe(true);
  });

  it('K10 account deletion clears this device\'s thumbnails, which hold resume text (DD-P11-10)', async () => {
    const userId = signedIn.user.id;
    await writeThumbnail({ userId, resumeId: 'r1', version: 1, engineVersion: 'x', page: {}, photoUrl: null });
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      if (String(input).includes('/auth/reauthenticate')) return new Response(JSON.stringify({ reauthenticatedUntil: '2026-11-06T12:00:00Z' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      if (init.method === 'DELETE') return new Response(JSON.stringify({ status: 'pending' }), { status: 202, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify(signedIn), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    window.history.replaceState({}, '', '/account');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /delete account/i }));
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: /confirm|continue/i }));
    const final = await within(screen.getByRole('dialog')).findByRole('button', { name: /^delete account$/i });
    fireEvent.click(final);
    await waitFor(async () => expect(await readThumbnail(userId, 'r1')).toBeNull());
  });

  // DD-P13-26: P06's provisional JSON download became the P13 archive (AC-P06-08 → AC-P13-14).
  it('unverified settings explains the disabled data download', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(unverified), { status: 200 })));
    window.history.replaceState({}, '', '/account');
    render(<App />);
    const exportAction = await screen.findByRole('button', { name: /download your data/i });
    expect(exportAction).toBeDisabled();
    expect(screen.getByText(/verify.*email/i)).toBeVisible();
  });
});


describe('P06 guest claim seam (AC-P06-10)', () => {
  it('renders no claim action when there is no local draft', () => {
    const onSave = vi.fn(); const onDiscard = vi.fn(); const onLater = vi.fn();
    const { container } = render(<ClaimDraft onSave={onSave} onDiscard={onDiscard} onLater={onLater} />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: /save draft/i })).toBeNull();
  });

  it('requires an explicit choice for a draft and cannot upload on its own', () => {
    const onSave = vi.fn(); const onDiscard = vi.fn(); const onLater = vi.fn();
    render(<ClaimDraft summary="Senior Analyst resume" onSave={onSave} onDiscard={onDiscard} onLater={onLater} />);
    expect(screen.getByText('Senior Analyst resume')).toBeVisible();
    // Rendering the prompt must not move the draft anywhere by itself.
    expect(onSave).not.toHaveBeenCalled();
    expect(onDiscard).not.toHaveBeenCalled();
    const later = screen.getByRole('button', { name: /later/i });
    const discard = screen.getByRole('button', { name: /discard draft/i });
    const save = screen.getByRole('button', { name: /save draft to account/i });
    // The non-destructive choice takes initial focus and nothing destructive is preselected.
    expect(later).toHaveFocus();
    fireEvent.click(save);
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(discard);
    expect(onDiscard).toHaveBeenCalledTimes(1);
    fireEvent.click(later);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('shows the draft title as text rather than markup', () => {
    render(<ClaimDraft summary="<img src=x onerror=alert(1)>" onSave={vi.fn()} onDiscard={vi.fn()} onLater={vi.fn()} />);
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeVisible();
    expect(document.querySelector('[role="dialog"] img')).toBeNull();
  });
});

describe('P06 account request contract', () => {
  it('shows contract password_too_common on sign-up without echoing the submitted password', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/session')
      ? new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 })
      : passwordProblem('/password', 'password_too_common')));
    window.history.replaceState({}, '', '/sign-up');
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'person-a@example.invalid' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/less common password/i);
    expect(alert).not.toHaveTextContent('synthetic-secret-123');
  });

  it('keeps keyboard focus after a rejected sign-up by moving it to the invalid field', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/session')
      ? new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 })
      : passwordProblem('/password', 'password_too_common')));
    window.history.replaceState({}, '', '/sign-up');
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'person-a@example.invalid' } });
    const password = screen.getByLabelText(/^password/i);
    fireEvent.change(password, { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));
    await screen.findByRole('alert');
    // The submit button is disabled while the request runs, which drops focus to the body; a keyboard
    // user must not have to traverse the page again to reach the field that was rejected.
    await waitFor(() => expect(password).toHaveFocus());
    expect(password).toHaveAttribute('aria-invalid', 'true');
  });

  it('keeps keyboard focus after a rejected login by moving it to the announced error', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/session')
      ? new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 })
      : new Response(JSON.stringify({ type: 'about:blank', title: 'Invalid credentials', status: 401, code: 'invalid_credentials', traceId: 'synthetic-trace' }),
        { status: 401, headers: { 'Content-Type': 'application/problem+json' } })));
    window.history.replaceState({}, '', '/login');
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'person-a@example.invalid' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    const alert = await screen.findByRole('alert');
    await waitFor(() => expect(document.body).not.toHaveFocus());
    expect(alert).toHaveFocus();
  });

  it('shows reset password policy error and keeps the valid fragment token for retry', async () => {
    const requests: string[] = [];
    let attempts = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input);
      if (path.endsWith('/session')) return new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 });
      if (path.endsWith('/auth/password-reset/confirm')) {
        requests.push(String(init?.body));
        return ++attempts === 1 ? passwordProblem('/newPassword', 'password_too_common') : new Response(null, { status: 204 });
      }
      throw new Error('Unexpected request');
    }));
    window.history.replaceState({}, '', '/reset-password/confirm#t=synthetic-reset-token');
    render(<App />);
    expect(window.location.hash).toBe('');
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
    expect(await screen.findByRole('alert')).toBeVisible();
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'different-synthetic-secret-456' } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(JSON.parse(requests[0]!)).toMatchObject({ token: 'synthetic-reset-token' });
    expect(JSON.parse(requests[1]!)).toMatchObject({ token: 'synthetic-reset-token' });
  });

  it('shows contract password_too_common on reset confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('/session')
      ? new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 })
      : passwordProblem('/newPassword', 'password_too_common')));
    window.history.replaceState({}, '', '/reset-password/confirm#t=synthetic-reset-token');
    render(<App />);
    fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /set new password/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/less common password/i);
  });

  it('shows contract password_too_short on account password change', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith('/session')) return new Response(JSON.stringify(signedIn), { status: 200 });
      if (path.endsWith('/auth/reauthenticate')) return new Response(null, { status: 204 });
      if (path.endsWith('/account/password')) return passwordProblem('/newPassword', 'password_too_short');
      throw new Error('Unexpected request');
    }));
    window.history.replaceState({}, '', '/account');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /change password/i }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/current password/i), { target: { value: 'synthetic-old-123' } });
    fireEvent.change(within(dialog).getByLabelText(/new password/i), { target: { value: 'synthetic-new-456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /^confirm$/i }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/at least 10 characters/i);
  });

  it('bootstraps an anonymous session before a reset request', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input); calls.push(path);
      if (path.includes('/session')) return new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 });
      return new Response(null, { status: 202 });
    }));
    window.history.replaceState({}, '', '/reset-password');
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'person-a@example.invalid' } });
    fireEvent.click(screen.getByRole('button', { name: /request|send/i }));
    await waitFor(() => expect(calls.some(path => path.includes('/auth/password-reset/request'))).toBe(true));
    expect(calls.findIndex(path => path.includes('/session'))).toBeLessThan(calls.findIndex(path => path.includes('/auth/password-reset/request')));
  });

  it('keeps settings controls hidden until the session resolves', async () => {
    let resolveSession!: (response: Response) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { resolveSession = resolve; })));
    window.history.replaceState({}, '', '/account');
    render(<App />);
    expect(screen.queryByRole('button', { name: /delete account|export.*json/i })).not.toBeInTheDocument();
    resolveSession(new Response(JSON.stringify(signedIn), { status: 200 }));
    expect(await screen.findByRole('button', { name: /delete account/i })).toBeVisible();
  });

  it('bootstraps CSRF before the first unsafe sign-up request', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input); calls.push(path);
      if (path.includes('/session')) return new Response(JSON.stringify({ authenticated: false, user: null }), { status: 200 });
      return new Response(null, { status: 202 });
    }));
    window.history.replaceState({}, '', '/sign-up');
    render(<App />);
    fireEvent.change(screen.getByRole('textbox', { name: /email/i }), { target: { value: 'person-a@example.invalid' } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: 'synthetic-secret-123' } });
    fireEvent.click(screen.getByRole('button', { name: /create account|sign up/i }));
    await waitFor(() => expect(calls.some(path => path.includes('/auth/sign-up'))).toBe(true));
    expect(calls.findIndex(path => path.includes('/session'))).toBeLessThan(calls.findIndex(path => path.includes('/auth/sign-up')));
  });

  it('changes password through PUT /account/password after reauthentication', async () => {
    const calls: Array<[string, string]> = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input); calls.push([init?.method ?? 'GET', path]);
      if (path.includes('/session')) return new Response(JSON.stringify(signedIn), { status: 200 });
      return new Response(null, { status: 204 });
    }));
    window.history.replaceState({}, '', '/account');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: /change password/i }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/current password/i), { target: { value: 'synthetic-old-123' } });
    fireEvent.change(within(dialog).getByLabelText(/new password/i), { target: { value: 'synthetic-new-456' } });
    fireEvent.click(within(dialog).getByRole('button', { name: /confirm|change password/i }));
    await waitFor(() => expect(calls.some(([method, path]) => method === 'PUT' && path.endsWith('/account/password'))).toBe(true));
    expect(calls.some(([method, path]) => method === 'POST' && path.endsWith('/account/password'))).toBe(false);
  });
});

describe('P08 sign-out and local data (T-ID-06)', () => {
  const key = `resumiser:last-section:${signedIn.user.id}:01934f6e-7a2b-7c3d-8e4f-000000000001`;
  const open = async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
      const path = new URL(String(input), 'http://localhost').pathname;
      calls.push(`${(init.method ?? 'GET').toUpperCase()} ${path}`);
      return path.endsWith('/auth/logout') ? new Response(null, { status: 204 }) : new Response(JSON.stringify(signedIn), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    window.history.replaceState({}, '', '/account');
    document.cookie = 'XSRF-TOKEN=synthetic-csrf';
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }));
    return calls;
  };
  beforeEach(() => localStorage.clear());

  it('AC-LOGOUT-1 with no local data logs out at once', async () => {
    const calls = await open();
    await waitFor(() => expect(calls).toContain('POST /api/v1/auth/logout'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC-LOGOUT-2 with local data offers removal, cancel and keep, and removes only on request', async () => {
    localStorage.setItem(key, 'section');
    localStorage.setItem('resumiser:last-section:someone-else:resume', 'section');
    const calls = await open();
    const dialog = within(await screen.findByRole('dialog', { name: /local data/i }));
    expect(calls).not.toContain('POST /api/v1/auth/logout');
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(localStorage.getItem(key)).toBe('section');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: /local data/i })).getByRole('button', { name: 'Remove and log out' }));
    await waitFor(() => expect(calls).toContain('POST /api/v1/auth/logout'));
    expect(localStorage.getItem(key)).toBeNull();
    expect(localStorage.getItem('resumiser:last-section:someone-else:resume')).toBe('section');
  });
});
