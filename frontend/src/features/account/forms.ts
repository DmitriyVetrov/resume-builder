import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { problemMessage, problemPasswordErrors, type PasswordFieldErrors } from '../../shared/api/client';

export type FieldErrors = Partial<Record<'email' | 'password' | 'newPassword', string>>;
export function useSubmission() {
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [fieldErrors, setFieldErrors] = useState<PasswordFieldErrors>({});
  const [failures, setFailures] = useState(0);
  const clearErrors = useCallback(() => { setError(''); setFieldErrors({}); }, []);

  // The submit button is disabled while the request runs, so the browser drops focus to <body>.
  // After a rejection put the keyboard user back on the field the server rejected, or on the
  // announced message when no single field is at fault, instead of at the top of the document.
  useEffect(() => {
    if (!failures) return;
    // Scope to the open dialog when there is one, so a re-auth dialog does not hand focus to a notice
    // on the page behind it.
    const scope: ParentNode = document.querySelector('[role="dialog"]') ?? document;
    const named = Object.keys(fieldErrors)[0];
    const field = named ? scope.querySelector<HTMLElement>(`[name="${named}"][aria-invalid="true"]`) : null;
    if (field) field.focus();
    else scope.querySelector<HTMLElement>('p.notice.error')?.focus();
  }, [failures, fieldErrors]);

  const run = useCallback(async (action: () => Promise<void>) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    clearErrors();
    setStatus('');
    try { await action(); }
    catch (error) {
      setError(problemMessage(error));
      setFieldErrors(problemPasswordErrors(error));
      setFailures((count) => count + 1);
    }
    finally { pending.current = false; setBusy(false); }
  }, [clearErrors]);
  return { busy, error, setError, clearErrors, fieldErrors, status, setStatus, run };
}

export function useFormValidation() {
  const [errors, setErrors] = useState<FieldErrors>({});
  function validate(event: FormEvent<HTMLFormElement>, values: { email?: string; password?: string; newPassword?: string }, newPassword = false) {
    event.preventDefault();
    const next: FieldErrors = {};
    if (values.email !== undefined && !/^[^\s@]+@[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email address.';
    for (const name of ['password', 'newPassword'] as const) {
      const value = values[name];
      if (value === undefined) continue;
      const length = Array.from(value).length;
      if (!length) next[name] = 'Enter a password.';
      else if ((newPassword || name === 'newPassword') && length < 10) next[name] = 'Use at least 10 characters.';
      else if (length > 128) next[name] = 'Use no more than 128 characters.';
    }
    setErrors(next);
    const invalid = Object.keys(next)[0];
    if (invalid) {
      const input = event.currentTarget.elements.namedItem(invalid);
      if (input instanceof HTMLElement) input.focus();
    }
    return !invalid;
  }
  return { errors, validate, setErrors };
}
