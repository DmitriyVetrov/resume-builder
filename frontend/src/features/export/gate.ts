import { useEffect } from 'react';
import type { ResumeDocument } from '../../entities/resume/operations';
import { useSession } from '../account/session';

export type ExportBlocker = 'full_name' | 'verify';
export const FULL_NAME_REASON = 'Add your full name to export.';
export const VERIFY_REASON = 'Verify your e-mail address to export.';

/** FR-TYP-03. Blank is missing. */
export const hasFullName = (document: ResumeDocument) => document.header.fullName.trim() !== '';

/**
 * ADR-013: a product rule, not a security boundary, since the export runs here (T-EP-04). Unknown counts as verified: the
 * session is read before this matters, and a stale "no" is put right when the window regains focus (DD-P12-06).
 */
export function useEmailVerified(): boolean {
  const { session, refresh } = useSession();
  const verified = session?.user?.emailVerified ?? true;
  useEffect(() => {
    if (verified) return;
    const check = () => { void refresh(true).catch(() => {}); };
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [verified, refresh]);
  return verified;
}
