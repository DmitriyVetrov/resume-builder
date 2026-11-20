import type { ContactKind } from './page-model';

export const ICON_BOX = 16;

/**
 * FR-HDR-05, in a 16 × 16 box, stroked. Only M, L, C and Z, with arcs as cubics: PDFKit converts an SVG arc with
 * trigonometry, whose results may differ between JavaScript engines (ADR-010 §7, DD-P11-16).
 */
export const ICON_PATHS: Record<ContactKind, string> = {
  email: 'M3 3.5 L13 3.5 C13.55 3.5 14 3.95 14 4.5 L14 11.5 C14 12.05 13.55 12.5 13 12.5 L3 12.5 C2.45 12.5 2 12.05 2 11.5 L2 4.5 C2 3.95 2.45 3.5 3 3.5 Z M3 4.5 L8 8.5 L13 4.5',
  phone: 'M5 2.5 L3.5 4 C3.7 8.4 7.6 12.3 12 12.5 L13.5 11 L11.1 8.6 L9.4 9.7 C8 8.9 6.6 7.5 5.8 6.1 L6.9 4.4 L5 2.5 Z',
  location: 'M13 6.5 C13 9.7 8 13.5 8 13.5 C8 13.5 3 9.7 3 6.5 C3 3.74 5.24 1.5 8 1.5 C10.76 1.5 13 3.74 13 6.5 Z M9.5 6.5 C9.5 7.33 8.83 8 8 8 C7.17 8 6.5 7.33 6.5 6.5 C6.5 5.67 7.17 5 8 5 C8.83 5 9.5 5.67 9.5 6.5 Z',
  link: 'M6.5 10 L5 11.5 C4.03 12.47 2.45 12.49 1.48 11.52 C0.51 10.55 0.53 8.97 1.5 8 L4.5 5 C5.47 4.05 7.03 4.05 8 5 M9.5 6 L11 4.5 C11.97 3.53 13.55 3.51 14.52 4.48 C15.49 5.45 15.47 7.03 14.5 8 L11.5 11 C10.53 11.95 8.97 11.95 8 11 M5.5 8.5 L10.5 7.5',
  other: 'M13.5 8 C13.5 11.04 11.04 13.5 8 13.5 C4.96 13.5 2.5 11.04 2.5 8 C2.5 4.96 4.96 2.5 8 2.5 C11.04 2.5 13.5 4.96 13.5 8 Z M8 7 L8 11 M8 4.8 L8.01 4.8',
};
