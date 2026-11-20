import { apiResource } from '../../shared/api/client';
import type { components } from '../../shared/api/generated/schema';
import type { ConflictCopy, SaveTransport } from './autosave';

type Schemas = components['schemas'];
export type Resume = Schemas['Resume'];
export type PhotoInfo = Schemas['PhotoInfo'];
export type PhotoCrop = Schemas['PhotoCrop'];
export type PhotoWriteResult = Schemas['PhotoWriteResult'];
export type SnapshotSummary = Schemas['SnapshotSummary'];
export type ResumeState = Schemas['ResumeState'];

const keyed = (key: string, version: number) => ({ 'Idempotency-Key': key, 'If-Match': `"${version}"` });

export const getResume = (id: string) => apiResource(`/resumes/${id}`) as Promise<Resume>;

/** `onSaved` gets the acknowledged time, which dates the next PDF (ADR-010 §7, DD-P12-02). */
export function saveTransport(id: string, onSaved: (updatedAt: string) => void): SaveTransport {
  return {
    write: async (body, key, version) => {
      const result = await apiResource(`/resumes/${id}/document`, { method: 'PUT', body, headers: keyed(key, version) }) as Schemas['DocumentWriteResult'];
      onSaved(result.updatedAt);
      return result;
    },
    createCopy: async (body, key) => {
      const created = await apiResource('/resumes', { method: 'POST', body, headers: { 'Idempotency-Key': key } }) as Resume;
      return { id: created.id, title: created.document.title } satisfies ConflictCopy;
    },
  };
}

export function uploadPhoto(id: string, file: File, version: number, key: string) {
  const body = new FormData();
  body.append('file', file);
  return apiResource(`/resumes/${id}/photo`, { method: 'POST', body, headers: keyed(key, version) }) as Promise<PhotoWriteResult>;
}

export const updatePhotoCrop = (id: string, crop: PhotoCrop, version: number, key: string) =>
  apiResource(`/resumes/${id}/photo/crop`, { method: 'PUT', body: JSON.stringify(crop), headers: keyed(key, version) }) as Promise<PhotoWriteResult>;

export const removePhoto = (id: string, version: number, key: string) =>
  apiResource(`/resumes/${id}/photo`, { method: 'DELETE', headers: keyed(key, version) }) as Promise<ResumeState>;

export function listSnapshots(id: string, cursor: string | null) {
  const query = cursor ? `?${new URLSearchParams({ cursor })}` : '';
  return apiResource(`/resumes/${id}/snapshots${query}`) as Promise<Schemas['SnapshotPage']>;
}

/** FR-PER-05. Answers 200 with the existing one if this version already has a snapshot. */
export const createSnapshot = (id: string, key: string) =>
  apiResource(`/resumes/${id}/snapshots`, { method: 'POST', body: JSON.stringify({ reason: 'before_export' } satisfies Schemas['CreateSnapshotRequest']), headers: { 'Idempotency-Key': key } }) as Promise<SnapshotSummary>;

export const getSnapshot = (id: string, snapshotId: string) =>
  apiResource(`/resumes/${id}/snapshots/${snapshotId}`) as Promise<Schemas['Snapshot']>;

export const renditionUrl = (id: string, photo: PhotoInfo) => `/api/v1/resumes/${id}/photo/rendition?v=${encodeURIComponent(photo.updatedAt)}`;
export const masterUrl = (id: string, photo: PhotoInfo) => `/api/v1/resumes/${id}/photo/master?v=${encodeURIComponent(photo.id)}`;
