import { apiResource } from '../../shared/api/client';
import type { ImportStructureRequest, ImportStructureResult } from './types';

/** `structureResumeImport` (contract 1.2.0): the extracted text to a draft. Never cached; safe to repeat. */
export function structureImport(request: ImportStructureRequest): Promise<ImportStructureResult> {
  return apiResource('/resume-imports/structure', { method: 'POST', body: JSON.stringify(request) }) as Promise<ImportStructureResult>;
}
