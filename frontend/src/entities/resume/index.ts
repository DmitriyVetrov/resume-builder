import type { components } from '../../shared/api/generated/schema';

type Schemas = components['schemas'];
export type ResumeDocument = Schemas['ResumeDocument'];
export const TITLE_LIMIT = 150;
const UNTITLED = 'Untitled resume';
const COPY_SUFFIX = ' (copy)';

const shell = { hidden: false, listColumns: null, placement: null };

/** ADR-018: the blank resume built in the client and created with `source: document`. */
export function blankResumeDocument(): ResumeDocument {
  const summary: Schemas['TextSection'] = { ...shell, id: crypto.randomUUID(), type: 'text', title: 'Professional Summary', content: { body: [] } };
  const experience: Schemas['EntriesSection'] = { ...shell, id: crypto.randomUUID(), type: 'entries', title: 'Professional Experience', content: { labels: { title: 'Role', organization: 'Organization', location: 'Location' }, entries: [] } };
  const education: Schemas['EntriesSection'] = { ...shell, id: crypto.randomUUID(), type: 'entries', title: 'Education', content: { labels: { title: 'Degree', organization: 'Institution', location: null }, entries: [] } };
  const skills: Schemas['ListSection'] = { ...shell, id: crypto.randomUUID(), type: 'list', title: 'Skills', content: { items: [] } };
  const languages: Schemas['InlineSection'] = { ...shell, id: crypto.randomUUID(), type: 'inline', title: 'Languages', content: { body: [{ kind: 'paragraph', inlines: [] }] } };
  return {
    title: UNTITLED,
    templateId: 'T1',
    accentPreset: 0,
    language: 'en',
    dateFormat: 'MonthYearLong',
    layout: { fontPreset: 'M', sectionSpacing: 10, entrySpacing: 10, lineSpacing: 1, pageSize: 'A4', margins: { top: 23, right: 23, bottom: 23, left: 23 }, bodyFont: null },
    header: { fullName: '', headline: '', showPhoto: true, contacts: [] },
    sections: [summary, experience, education, skills, languages],
  };
}

/** Length as the contract counts it: Unicode code points. */
export function titleLength(title: string): number {
  return Array.from(title).length;
}

export function displayTitle(title: string): string {
  return title || UNTITLED;
}

/** DD-P07-20: `<title> (copy)` cut by code points to the title limit. */
export function copyTitle(title: string): string {
  const room = TITLE_LIMIT - COPY_SUFFIX.length;
  return Array.from(displayTitle(title)).slice(0, room).join('') + COPY_SUFFIX;
}
