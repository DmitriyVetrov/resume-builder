import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ResumeDocument } from '../../entities/resume';
import { ApiError, problemMessage } from '../../shared/api/client';
import { Button, buttonClass, Input, StatusNotice } from '../../shared/ui';
import { Label } from '../../shared/ui/label';
import { uploadPhoto } from '../editor/api';
import { createResume } from '../library/api';
import { structureImport } from './api';
import { buildDocument } from './build';
import { fallbackDraft } from './fallback';
import { ImportError, type ImportErrorCode } from './pdf';
import { readCv, type ReadResult } from './read';
import { ReviewPreview } from './ReviewPreview';
import { capLines, serialize } from './serialize';
import type { ImportReport } from './types';

const NOTICE = 'The CV text is processed by Claude (Anthropic). The file and photo are not sent.';
const READ_MESSAGES: Record<ImportErrorCode, string> = {
  no_text_layer: 'This PDF has no text layer. Export it again with selectable text, or import a TXT file.',
  too_many_pages: 'This PDF has more than 5 pages. Import a CV of up to 5 pages.',
  too_large: 'This file is larger than 10 MB. Choose a smaller file.',
  unreadable: 'This file could not be read. Choose a PDF with selectable text or a TXT file.',
};
const RATE_MESSAGE = 'You have imported many CVs recently. Try again later.';
const LIMIT_MESSAGE = 'You have reached the limit of 200 resumes, counting the trash. Delete some from the trash to make room.';

type Review = { document: ResumeDocument; report: ImportReport; photo: Blob | null; key: string; body: string };
type State = { step: 'pick' } | { step: 'working'; label: string } | { step: 'review'; review: Review };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Report({ report, document }: { report: ImportReport; document: ResumeDocument }) {
  const { recognised } = report;
  const titles = document.sections.map(section => section.title).filter(Boolean);
  return <section className="space-y-2 rounded-lg border bg-card p-4 text-card-foreground" aria-label="Import report">
    <h3 className="text-lg font-semibold">Import report</h3>
    <p>Recognised {plural(recognised.contacts, 'contact', 'contacts')}, {plural(recognised.sections, 'section', 'sections')} and {plural(recognised.entries, 'entry', 'entries')}.</p>
    {titles.length > 0 && <p>Sections: {titles.join(', ')}.</p>}
    {report.photo && <p>The photo from the CV will be added.</p>}
    {report.droppedImages > 0 && <p>{report.droppedImages === 1 ? '1 image was not imported.' : `${report.droppedImages} images were not imported.`}</p>}
    {report.sourceCapped && <p>The CV is very long, so only its first part was imported.</p>}
    {report.notInSource.length > 0 && <><p>Left out because they did not match the CV text:</p><ul className="list-disc pl-5">{report.notInSource.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
    {report.clamped.length > 0 && <><p>Shortened to fit the length limits:</p><ul className="list-disc pl-5">{report.clamped.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
    {report.overLimit.length > 0 && <><p>Not imported, over the limits:</p><ul className="list-disc pl-5">{report.overLimit.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
  </section>;
}

/** IMP-01, ADR-055: pick a CV, read it in the browser, structure it on the server, review it, create the resume. */
export default function ImportPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ step: 'pick' });
  const [failure, setFailure] = useState('');
  const [creating, setCreating] = useState(false);
  const attempt = useRef(0);
  const reviewHeading = useRef<HTMLHeadingElement>(null);
  const reviewing = state.step === 'review';
  // The picker that had the focus is gone: the review heading takes it (NFR-06).
  useEffect(() => { if (reviewing) reviewHeading.current?.focus(); }, [reviewing]);

  const signIn = () => navigate(`/login?returnTo=${encodeURIComponent('/resumes/import')}`, { replace: true });

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const current = ++attempt.current;
    setFailure('');
    setState({ step: 'working', label: 'Reading the CV…' });
    let read: ReadResult;
    try {
      read = await readCv(file);
    } catch (error) {
      if (current !== attempt.current) return;
      setFailure(error instanceof ImportError ? READ_MESSAGES[error.code] : READ_MESSAGES.unreadable);
      setState({ step: 'pick' });
      return;
    }
    if (current !== attempt.current) return;
    setState({ step: 'working', label: 'Structuring the CV…' });
    const { analysis } = read;
    const source = read.text !== undefined ? capLines(read.text.split(/\r\n?|\n/)) : serialize(analysis);
    const context = { columns: analysis.columns, sidebarSide: analysis.sidebarSide, droppedImages: analysis.droppedImages, photo: Boolean(read.photo), sourceCapped: source.capped };
    let built: ReturnType<typeof buildDocument>;
    try {
      const result = await structureImport({ sourceText: source.text, sourceFormat: read.format, layoutHint: { columns: analysis.columns, sidebarSide: analysis.sidebarSide } });
      built = buildDocument(result.draft, { ...context, warnings: result.warnings, basic: false });
    } catch (error) {
      if (current !== attempt.current) return;
      if (error instanceof ApiError && error.status === 401) { signIn(); return; }
      if (error instanceof ApiError && error.status === 429) { setFailure(RATE_MESSAGE); setState({ step: 'pick' }); return; }
      // ADR-055 §5: without the server's structure the local parser keeps the user's text.
      built = buildDocument(fallbackDraft(analysis), { ...context, warnings: [], basic: true });
    }
    if (current !== attempt.current) return;
    const body = JSON.stringify({ source: 'document', document: built.document, copyPhotoFromResumeId: null });
    setState({ step: 'review', review: { ...built, photo: read.photo, key: crypto.randomUUID(), body } });
  };

  const create = async (review: Review) => {
    setCreating(true);
    setFailure('');
    try {
      // One key and one body per review, so a retry after an unknown outcome cannot create a second resume.
      const created = await createResume(review.body, review.key);
      if (review.photo) {
        const file = new File([review.photo], 'photo.png', { type: 'image/png' });
        // The resume exists already; a refused photo can be added in the editor.
        await uploadPhoto(created.id, file, created.version, crypto.randomUUID()).catch(() => undefined);
      }
      navigate(`/resumes/${created.id}/edit`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) { signIn(); return; }
      setFailure(error instanceof ApiError && error.problem?.code === 'limit_reached' ? LIMIT_MESSAGE : problemMessage(error));
      setCreating(false);
    }
  };

  return <main id="main-content" className="library-main">
    <div className="library-head"><h1>Import a CV</h1></div>
    <p className="mt-4">{NOTICE}</p>
    {state.step !== 'review' && <div className="mt-6 max-w-md space-y-2">
      <Label htmlFor="import-file">CV file (PDF or TXT)</Label>
      <Input id="import-file" type="file" accept=".pdf,.txt,application/pdf,text/plain" disabled={state.step === 'working'} onChange={event => void choose(event)} />
      <p className="text-sm text-muted-foreground">A PDF with selectable text of up to 5 pages, or a TXT file exported from Resumiser. Up to 10 MB.</p>
    </div>}
    <p className="mt-4 min-h-6" role="status">{state.step === 'working' ? state.label : reviewing ? 'The CV is ready to review.' : ''}</p>
    {failure && <StatusNotice error>{failure}</StatusNotice>}
    {state.step === 'review' && <section className="mt-2" aria-labelledby="import-review-title">
      <h2 id="import-review-title" ref={reviewHeading} tabIndex={-1} className="text-2xl font-semibold">Review the import</h2>
      {state.review.report.basic && <StatusNotice>Basic import: the CV could not be structured automatically, so its text is kept in simple sections. Check them in the editor.</StatusNotice>}
      <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <ReviewPreview document={state.review.document} photo={state.review.photo} />
        <div className="space-y-4">
          <Report report={state.review.report} document={state.review.document} />
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={creating} onClick={() => void create(state.review)}>Create resume</Button>
            <Button type="button" variant="secondary" disabled={creating} onClick={() => { setFailure(''); setState({ step: 'pick' }); }}>Choose another file</Button>
            <Link className={buttonClass('secondary')} to="/resumes">Cancel</Link>
          </div>
        </div>
      </div>
    </section>}
    {state.step !== 'review' && <p><Link to="/resumes">Back to resumes</Link></p>}
  </main>;
}
