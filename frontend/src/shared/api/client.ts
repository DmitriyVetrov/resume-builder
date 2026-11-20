import type { components, paths } from './generated/schema';

export type ApiPath = keyof paths;
export type ApiProblem = components['schemas']['Problem'];
export type AccountSchemas = components['schemas'];
export type SessionInfo = AccountSchemas['SessionInfo'];
export type AccountDataExport = AccountSchemas['AccountDataExport'];
type MethodFor<P extends ApiPath> = {
  [M in keyof paths[P]]: M extends 'get' | 'post' | 'put' | 'delete' | 'patch' | 'head' | 'options' ? paths[P][M] extends undefined ? never : Uppercase<M> : never
}[keyof paths[P]];
type RequestOptions<P extends ApiPath> = Omit<RequestInit, 'method'> & { method?: MethodFor<P> };

export class ApiError extends Error {
  constructor(readonly status: number, readonly problem: ApiProblem | null, readonly retryAfter: string | null = null) {
    super('API request failed');
  }
}

function csrfToken() {
  const value = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('XSRF-TOKEN='))?.slice(11);
  if (!value) return null;
  try { return decodeURIComponent(value); } catch { return null; }
}

async function send(path: string, init?: RequestInit): Promise<unknown> {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  const method = (init?.method || 'GET').toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const token = csrfToken();
    if (token) headers.set('X-XSRF-TOKEN', token);
    if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`/api/v1${path}`, {
    ...init, credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer', headers,
  });
  if (!response.ok) {
    let problem: ApiProblem | null = null;
    if (response.headers.get('content-type')?.includes('application/problem+json')) {
      try { problem = await response.json() as ApiProblem; } catch { /* Malformed errors still have a safe status fallback. */ }
    }
    throw new ApiError(response.status, problem, response.headers.get('Retry-After'));
  }
  return response.status === 204 || response.status === 202 ? undefined : response.json();
}

export function apiRequest<P extends ApiPath>(path: P, init?: RequestOptions<P>): Promise<unknown> {
  return apiResource(path, init);
}

let bootstrap: Promise<unknown> | null = null;

/** One `GET /session` at a time: concurrent first mutations share it, and so share one cookie pair (AC-P13-13). */
function bootstrapSession(): Promise<unknown> {
  bootstrap ??= send('/session').finally(() => { bootstrap = null; });
  return bootstrap;
}

/** For a concrete resource path such as `/resumes/{id}`, which the path-template types cannot name. */
export async function apiResource(path: string, init?: RequestInit): Promise<unknown> {
  const unsafe = init?.method && !['GET', 'HEAD', 'OPTIONS'].includes(init.method);
  // Anonymous auth requests need the same CSRF bootstrap as signed-in actions.
  if (unsafe && !csrfToken()) await bootstrapSession();
  try {
    return await send(path, init);
  } catch (error) {
    if (!unsafe || !(error instanceof ApiError) || error.problem?.code !== 'csrf_token_invalid') throw error;
    // DD-P13-17: the header is read from the cookie before the request goes, so a bootstrap answer landing later can
    // replace the pair under it. Antiforgery refuses before any effect, so the request changed nothing: refresh, retry once.
    try { await bootstrapSession(); } catch { throw error; }
    return await send(path, init);
  }
}

const passwordMessages = {
  password_too_short: 'Use at least 10 characters.',
  password_too_long: 'Use no more than 128 characters.',
  password_too_common: 'Choose a less common password.',
} as const;
export type PasswordFieldErrors = Partial<Record<'password' | 'newPassword', string>>;

export function problemPasswordErrors(error: unknown): PasswordFieldErrors {
  const fields: PasswordFieldErrors = {};
  if (!(error instanceof ApiError) || error.status !== 400 || error.problem?.code !== 'validation_failed' || !Array.isArray(error.problem.errors)) return fields;
  for (const issue of error.problem.errors) {
    if (issue.location !== 'body' || (issue.pointer !== '/password' && issue.pointer !== '/newPassword')) continue;
    const message = Object.hasOwn(passwordMessages, issue.code) ? passwordMessages[issue.code as keyof typeof passwordMessages] : undefined;
    if (!message) continue;
    const field = issue.pointer === '/password' ? 'password' : 'newPassword';
    if (!fields[field]?.includes(message)) fields[field] = fields[field] ? `${fields[field]} ${message}` : message;
  }
  return fields;
}

export function problemMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const passwordErrors = [...new Set(Object.values(problemPasswordErrors(error)))];
    if (passwordErrors.length) return passwordErrors.join(' ');
    switch (error.problem?.code) {
      case 'invalid_credentials': return 'Invalid credentials. Try again.';
      case 'token_invalid': return 'This link is invalid or expired. Request a new one.';
      case 'reauthentication_required': return 'Please confirm your password again.';
      case 'reauthentication_failed': return 'Password could not be confirmed. Try again.';
      case 'email_not_verified': return 'Verify your email before exporting.';
      case 'csrf_token_invalid': return 'Your security check expired. Please try again.';
    }
    if (error.status === 429) {
      const seconds = error.retryAfter && /^\d+$/.test(error.retryAfter) ? Number(error.retryAfter) : null;
      return seconds !== null ? `Too many attempts. Try again in ${seconds} seconds.` : 'Too many attempts. Please try again later.';
    }
    if (error.status === 401) return 'Please log in and try again.';
    if (error.status === 403) return 'This action is unavailable. Please try again.';
    if (error.status >= 500) return 'The service is unavailable. Please try again.';
  }
  return 'Something went wrong. Please try again.';
}

export function jsonBody(value: object) {
  return { method: 'POST' as const, body: JSON.stringify(value) };
}
