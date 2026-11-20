import { useCallback, useEffect, useDeferredValue, useMemo, useState } from 'react';
import type { PageModel } from '../../entities/layout';
import { ENGINE_VERSION } from '../../entities/layout/version';
import type { ResumeDocument } from '../../entities/resume/operations';
import { resolveDesign } from '../../entities/template';
import { reportClientEvent } from '../../shared/api/client-events';
import { failureCode, loadRuntime, type PreviewFailure, type PreviewRuntime } from './runtime';

export type PageModelState = { status: 'loading' | 'ready' | 'failed'; model: PageModel | null; document: ResumeDocument | null; runtime: PreviewRuntime | null; retry: () => void };

const report = (code: PreviewFailure, resumeId: string) => reportClientEvent('preview_failed', code, resumeId, ENGINE_VERSION);

/** The engine with `fontId` ready, or null until then. Changing to a new family keeps the last runtime out of use until its bytes are in. */
export function useRuntime(fontId: string | null, onFailure?: (code: PreviewFailure) => void, attempt = 0) {
  const [ready, setReady] = useState<{ fontId: string; attempt: number; runtime: PreviewRuntime } | null>(null);
  useEffect(() => {
    if (!fontId) return;
    let current = true;
    loadRuntime(fontId).then(runtime => { if (current) setReady({ fontId, attempt, runtime }); }, error => { if (current) onFailure?.(failureCode(error)); });
    return () => { current = false; };
  }, [fontId, attempt, onFailure]);
  return ready?.fontId === fontId ? ready.runtime : null;
}

/**
 * The single layout result of a mounted document (FR-PRV-02): the preview and the page counter read this one object.
 * Deferred, so the form renders first and a newer keystroke can abandon a stale layout (DD-P11-01).
 */
export function usePageModel(document: ResumeDocument | null, hasPhoto: boolean, resumeId: string): PageModelState {
  const deferred = useDeferredValue(document);
  const fontId = deferred ? resolveDesign(deferred).font.id : null;
  const [attempt, setAttempt] = useState(0);
  const [loadFailure, setLoadFailure] = useState<PreviewFailure | null>(null);
  const onFailure = useCallback((code: PreviewFailure) => { setLoadFailure(code); report(code, resumeId); }, [resumeId]);
  const runtime = useRuntime(fontId, onFailure, attempt);
  // The document last laid out: a new font keeps the old pages on screen until its bytes arrive.
  const [shown, setShown] = useState<{ document: ResumeDocument; runtime: PreviewRuntime } | null>(null);
  if (deferred && runtime && (shown?.document !== deferred || shown.runtime !== runtime)) setShown({ document: deferred, runtime });
  const result = useMemo(() => {
    if (!shown) return null;
    try { return { model: shown.runtime.layout(shown.document, hasPhoto), failed: false }; }
    catch { return { model: null, failed: true }; }
  }, [shown, hasPhoto]);
  const layoutFailed = result?.failed ?? false;
  useEffect(() => { if (layoutFailed) report('layout_error', resumeId); }, [layoutFailed, resumeId]);
  const retry = useCallback(() => { setLoadFailure(null); setAttempt(count => count + 1); }, []);
  // A runtime for the current font means that load succeeded, so a failure of another font no longer applies.
  const failed = (loadFailure !== null && !runtime) || layoutFailed;
  return { status: failed ? 'failed' : result?.model ? 'ready' : 'loading', model: result?.model ?? null, document: shown?.document ?? null, runtime: shown?.runtime ?? null, retry };
}
