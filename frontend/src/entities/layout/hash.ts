import type { PageModel } from './page-model';

/** Canonical serialisation: key order is the order the engine writes, and every number is quantised. */
export const canonicalJson = (model: PageModel) => JSON.stringify(model);

function hash32(text: string, seed: number) {
  let h = seed >>> 0;
  for (let index = 0; index < text.length; index++) {
    h = Math.imul(h ^ text.charCodeAt(index), 16777619);
    h = (h ^ (h >>> 15)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export const canonicalHash = (model: PageModel) => { const json = canonicalJson(model); return `${hash32(json, 2166136261)}${hash32(json, 16777619)}${json.length.toString(16)}`; };
