import { apiResource } from '../../shared/api/client';
import type { components } from '../../shared/api/generated/schema';

type Schemas = components['schemas'];
export type ResumeSummary = Schemas['ResumeSummary'];
export type Resume = Schemas['Resume'];
export type CreateResumeRequest = Schemas['CreateResumeRequest'];
export type ListState = 'active' | 'trashed';

const keyed = (key: string, version?: number): Record<string, string> =>
  version === undefined ? { 'Idempotency-Key': key } : { 'Idempotency-Key': key, 'If-Match': `"${version}"` };

export function listResumes(state: ListState, cursor: string | null) {
  const query = new URLSearchParams({ state });
  if (cursor) query.set('cursor', cursor);
  return apiResource(`/resumes?${query}`) as Promise<Schemas['ResumePage']>;
}

export function getResume(id: string) {
  return apiResource(`/resumes/${id}`) as Promise<Resume>;
}

/** `body` is a serialised `CreateResumeRequest`, kept by the caller so a retry sends the same bytes under the same key. */
export function createResume(body: string, key: string) {
  return apiResource('/resumes', { method: 'POST', body, headers: keyed(key) }) as Promise<Resume>;
}

export function replaceDocument(id: string, version: number, body: string, key: string) {
  return apiResource(`/resumes/${id}/document`, { method: 'PUT', body, headers: keyed(key, version) });
}

export function trashResume(id: string, version: number, key: string) {
  return apiResource(`/resumes/${id}`, { method: 'DELETE', headers: keyed(key, version) });
}

export function restoreResume(id: string, version: number, key: string) {
  return apiResource(`/resumes/${id}/restore`, { method: 'POST', headers: keyed(key, version) });
}

export function purgeResume(id: string, version: number, key: string) {
  return apiResource(`/resumes/${id}/purge`, { method: 'POST', headers: keyed(key, version) });
}
