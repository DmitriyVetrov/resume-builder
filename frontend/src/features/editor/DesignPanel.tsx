import { useDeferredValue, useId, useMemo, useState } from 'react';
import { formatEntryDates } from '../../entities/resume/dates';
import { isValidCustomMargin, marginChoice, MARGIN_PRESETS, resetDesign, setAccent, setBodyFont, setDateFormat, setFontPreset, setLanguage, setMargins, setPageSize, setPlacement, setSpacing, switchTemplate } from '../../entities/resume/design-operations';
import type { ResumeDocument, Section } from '../../entities/resume/operations';
import { definitionOf, resolveDesign, TEMPLATES } from '../../entities/template';
import { Button, CONTROL, Input } from '../../shared/ui';
import { PageThumbnail } from '../preview-paint/PageSheet';
import type { PageModelState } from '../preview-paint/use-page-model';
import { useRuntime } from '../preview-paint/use-page-model';
import { renditionUrl, type PhotoInfo } from './api';
import { DesignCard, RadioGroup, Segmented, SelectField, Slider } from './design/controls';
import { pageCountText } from './PreviewPanel';
import type { EditOptions, EditorSession } from './session';
import { sectionName } from './SectionPanel';
import './design/design.css';

type Edit = (change: (document: ResumeDocument) => ResumeDocument, options: EditOptions) => void;

const FONT_SIZES = [{ value: 'S', label: 'Small' }, { value: 'M', label: 'Medium' }, { value: 'L', label: 'Large' }] as const;
const PAGE_SIZES = [{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'US Letter' }] as const;
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'es', label: 'Español' }, { value: 'uk', label: 'Українська' }] as const;
const DATE_FORMATS = ['MonthYearLong', 'MonthYearShort', 'Numeric', 'YearOnly'] as const;
const SAMPLE_DATE = { start: { kind: 'date', year: 2025, month: 10 }, end: null, dateText: '' } as const;
const SPACINGS = [['Section spacing', 'sectionSpacing'], ['Entry spacing', 'entrySpacing'], ['Line spacing', 'lineSpacing']] as const;

/** FR-TPL-02, DD-P11-09: page 1 of this document under one template. Deferred, so typing never waits for it. */
function TemplateThumb({ document, templateId, photoUrl }: { document: ResumeDocument; templateId: ResumeDocument['templateId']; photoUrl: string | null }) {
  const shown = useDeferredValue(document);
  const candidate = useMemo(() => ({ ...shown, templateId }), [shown, templateId]);
  const runtime = useRuntime(resolveDesign(candidate).font.id);
  const page = useMemo(() => {
    try { return runtime?.layout(candidate, photoUrl !== null).pages[0] ?? null; }
    catch { return null; }
  }, [runtime, candidate, photoUrl]);
  return page && <PageThumbnail page={page} photoUrl={photoUrl} templateId={templateId} />;
}

function TemplatePicker({ document, photoUrl, visible, edit }: { document: ResumeDocument; photoUrl: string | null; visible: boolean; edit: Edit }) {
  const name = useId();
  return <RadioGroup legend="Template" className="template-picker">
    {TEMPLATES.map(template => {
      const selected = template.id === document.templateId;
      return <label key={template.id} className={`design-option template-option ${selected ? 'is-selected' : ''}`}>
        <input type="radio" name={name} value={template.id} aria-label={template.name} checked={selected} onChange={() => edit(current => switchTemplate(current, template.id as ResumeDocument['templateId']), { label: 'template change' })} />
        <span className="template-thumb" aria-hidden="true">
          {visible && <TemplateThumb document={document} templateId={template.id as ResumeDocument['templateId']} photoUrl={photoUrl} />}
          {selected && <span className="template-check"><CheckMark /></span>}
        </span>
        <span className="template-name">{template.name}</span>
      </label>;
    })}
  </RadioGroup>;
}

const CheckMark = () => <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" focusable="false"><path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;

function Swatches({ document, edit }: { document: ResumeDocument; edit: Edit }) {
  const design = resolveDesign(document);
  const name = useId();
  return <div className="swatch-row">
    <RadioGroup legend="Accent colour" className="swatches">
      {design.definition.accents.map((accent, index) => {
        const selected = index === document.accentPreset;
        return <label key={accent.name} className={`design-option swatch ${selected ? 'is-selected' : ''}`}>
          <input type="radio" name={name} value={index} aria-label={accent.name} checked={selected} onChange={() => edit(current => setAccent(current, index as ResumeDocument['accentPreset']), { label: 'colour change' })} />
          <span className="swatch-dot" style={{ background: accent.hex }} aria-hidden="true">{selected && <span data-testid="swatch-check" className="swatch-check"><CheckMark /></span>}</span>
        </label>;
      })}
    </RadioGroup>
    <span className="swatch-name" data-testid="swatch-name">{design.accentName}</span>
  </div>;
}

function Margins({ document, edit }: { document: ResumeDocument; edit: Edit }) {
  const { margins } = document.layout;
  const choice = marginChoice(margins);
  const id = useId();
  const [customOpen, setCustomOpen] = useState(false);
  const [text, setText] = useState(String(margins.top));
  const [invalid, setInvalid] = useState(false);
  const selected = customOpen || choice === 'custom' ? 'custom' : choice;
  const pick = (value: typeof selected) => {
    setInvalid(false);
    if (value === 'custom') { setText(String(margins.top)); setCustomOpen(true); return; }
    setCustomOpen(false);
    const preset = MARGIN_PRESETS.find(item => item.id === value);
    if (preset) edit(current => setMargins(current, preset.value), { label: 'margins change' });
  };
  const commit = () => {
    const value = Number(text);
    if (text.trim() === '' || !isValidCustomMargin(value)) { setInvalid(true); return; }
    setInvalid(false);
    edit(current => setMargins(current, value), { label: 'margins change' });
  };
  // A margin changed elsewhere (undo, reset, another tab) replaces text the user is not editing.
  const [seen, setSeen] = useState(margins.top);
  if (seen !== margins.top) { setSeen(margins.top); setText(String(margins.top)); setInvalid(false); if (choice !== 'custom') setCustomOpen(false); }
  return <div>
    <Segmented legend="Margins" value={selected} onChange={pick} options={[...MARGIN_PRESETS.map(item => ({ value: item.id, label: item.label })), { value: 'custom' as const, label: 'Custom' }]} />
    {selected === 'custom' && <div className="field design-custom">
      <label htmlFor={id} className="design-label">Custom margin in points</label>
      <Input id={id} className={CONTROL} type="number" min={10} max={50} step={0.5} value={text} aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={event => setText(event.target.value)} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); commit(); } }} />
      {invalid && <p className="field-error" id={`${id}-error`}>Enter a number between 10 and 50, in steps of 0.5.</p>}
    </div>}
  </div>;
}

function Placement({ document, edit }: { document: ResumeDocument; edit: Edit }) {
  const definition = definitionOf(document.templateId);
  const { zones } = definition;
  const id = useId();
  if (!zones) return null;
  const sectionLabel = { main: 'Main', sidebar: 'Sidebar' } as const;
  return <DesignCard>
    <div role="group" aria-labelledby={id}>
      <h3 id={id} className="design-card-title">Column for each section</h3>
      {(document.sections as Section[]).map(section => <SelectField key={section.id} label={sectionName(section)} value={(section.placement ?? '') as '' | 'main' | 'sidebar'}
        options={[{ value: '', label: `${sectionLabel[zones.defaults[section.type]]} (default)` }, { value: 'main', label: 'Main' }, { value: 'sidebar', label: 'Sidebar' }]}
        onChange={value => edit(current => setPlacement(current, section.id, value === '' ? null : value), { label: 'column change' })} />)}
    </div>
  </DesignCard>;
}

/** FR-PRV-04, FR-PRV-05: beside the spacing controls. Fit lowers spacing and the preset by the least that fits, or says it cannot (DD-P11-08). */
function PageFit({ document, pageModel, hasPhoto, edit, announce }: { document: ResumeDocument; pageModel: PageModelState; hasPhoto: boolean; edit: Edit; announce: (text: string) => void }) {
  const pages = pageModel.model?.pages.length ?? null;
  const [target, setTarget] = useState(1);
  const [result, setResult] = useState('');
  if (pages === null) return null;
  const chosen = Math.min(target, pages);
  const fit = () => {
    // The layout still shows the previous font while a new one loads; Fit needs the current one.
    if (!pageModel.runtime || pageModel.document !== document) { setResult('The preview is still updating. Try again in a moment.'); return; }
    const outcome = pageModel.runtime.fit(document, chosen, hasPhoto);
    const wanted = pageCountText(chosen);
    const text = outcome.outcome === 'impossible' ? `Cannot fit on ${wanted}: the smallest settings still give ${pageCountText(outcome.pages)}.`
      : outcome.outcome === 'already' ? `Already fits on ${wanted}.`
        : `Fits on ${pageCountText(outcome.pages)}. Undo is available.`;
    if (outcome.outcome === 'fitted') edit(current => ({ ...current, layout: outcome.document.layout }), { label: 'fit to pages' });
    setResult(text);
    announce(text);
  };
  return <>
    <p className="page-count" data-testid="page-count" aria-live="polite">{pageCountText(pages)}</p>
    <div className="fit-row">
      <SelectField label="Fit to pages" value={String(chosen)} options={Array.from({ length: pages }, (_, index) => ({ value: String(index + 1), label: String(index + 1) }))} onChange={value => setTarget(Number(value))} />
      <Button variant="secondary" onClick={fit}>Fit</Button>
    </div>
    {result && <p className="fit-result" data-testid="fit-result">{result}</p>}
  </>;
}

/** FR-EDT-05, §5.8–§5.10. Every control edits through the session, so undo and autosave come with it. */
export function DesignPanel({ session, document, photo, pageModel, visible }: { session: EditorSession; document: ResumeDocument; photo: PhotoInfo | null; pageModel: PageModelState; visible: boolean }) {
  const edit: Edit = (change, options) => session.apply(change, options);
  const design = resolveDesign(document);
  const { defaults } = design.definition;
  const { layout } = document;
  const reset = () => { edit(resetDesign, { label: 'reset design' }); session.announce('Design reset. Undo is available.'); };
  return <div className="design-panel">
    <DesignCard><TemplatePicker document={document} photoUrl={photo ? renditionUrl(session.resumeId, photo) : null} visible={visible} edit={edit} /></DesignCard>
    <DesignCard><Swatches document={document} edit={edit} /></DesignCard>
    <DesignCard>
      <Segmented legend="Font size" value={layout.fontPreset} options={FONT_SIZES} onChange={value => edit(current => setFontPreset(current, value), { label: 'font size change' })} />
      <SelectField label="Body font" value={design.font.id} options={design.fontOptions.map(font => ({ value: font.id, label: font.name }))} onChange={value => edit(current => setBodyFont(current, value), { label: 'body font change' })} />
    </DesignCard>
    <DesignCard>
      {SPACINGS.map(([label, key]) => <Slider key={key} label={label} value={layout[key]}
        onChange={value => edit(current => setSpacing(current, key, value), { label: `${label.toLowerCase()} change`, coalesce: `design:${key}` })}
        onReset={() => edit(current => setSpacing(current, key, defaults[key]), { label: `${label.toLowerCase()} reset` })} />)}
      <PageFit document={document} pageModel={pageModel} hasPhoto={photo !== null} edit={edit} announce={text => session.announce(text)} />
    </DesignCard>
    <DesignCard>
      <Segmented legend="Page size" value={layout.pageSize} options={PAGE_SIZES} onChange={value => edit(current => setPageSize(current, value), { label: 'page size change' })} />
      <Margins document={document} edit={edit} />
    </DesignCard>
    <DesignCard>
      <div className="field-grid">
        <SelectField label="Language" value={document.language} options={LANGUAGES} onChange={value => edit(current => setLanguage(current, value), { label: 'language change' })} />
        <SelectField label="Date format" value={document.dateFormat} options={DATE_FORMATS.map(value => ({ value, label: formatEntryDates(SAMPLE_DATE, document.language, value) }))} onChange={value => edit(current => setDateFormat(current, value), { label: 'date format change' })} />
      </div>
    </DesignCard>
    <Placement document={document} edit={edit} />
    <DesignCard><Button variant="secondary" onClick={reset}>Reset design</Button></DesignCard>
  </div>;
}

