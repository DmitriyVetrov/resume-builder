import type { Page } from '../../entities/layout/page-model';
import { ENGINE_VERSION } from '../../entities/layout/version';
import { readThumbnail, removeThumbnail, writeThumbnail } from '../../entities/resume/local-data';
import { resolveDesign } from '../../entities/template';
import { ApiError } from '../../shared/api/client';
import { renditionUrl } from '../editor/api';
import { ensurePageFonts, loadRuntime } from '../preview-paint/runtime';
import { getResume, type ResumeSummary } from './api';

export type ThumbnailPage = { page: Page; photoUrl: string | null };

const LIMIT = 3;
let running = 0;
const waiting: (() => void)[] = [];

/** DD-P11-11: no more than three documents at a time, however many cards scroll into view. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (running >= LIMIT) await new Promise<void>(start => waiting.push(start));
  else running++;
  try { return await task(); }
  finally {
    const next = waiting.shift();
    if (next) next();
    else running--;
  }
}

/** ADR-010 §9. Null on any failure: a card without a thumbnail is still a working card. */
export async function loadThumbnail(userId: string, item: ResumeSummary): Promise<ThumbnailPage | null> {
  try {
    const cached = await readThumbnail(userId, item.id).catch(() => null);
    if (cached && cached.version === item.version && cached.engineVersion === ENGINE_VERSION) {
      const page = cached.page as Page;
      await ensurePageFonts(page);
      return { page, photoUrl: cached.photoUrl };
    }
    return await limited(async () => {
      const resume = await getResume(item.id);
      const runtime = await loadRuntime(resolveDesign(resume.document).font.id);
      const page = runtime.layout(resume.document, resume.photo !== null).pages[0] as Page;
      const photoUrl = resume.photo ? renditionUrl(resume.id, resume.photo) : null;
      await writeThumbnail({ userId, resumeId: resume.id, version: resume.version, engineVersion: ENGINE_VERSION, page, photoUrl }).catch(() => {});
      return { page, photoUrl };
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) await removeThumbnail(userId, item.id).catch(() => {});
    return null;
  }
}
