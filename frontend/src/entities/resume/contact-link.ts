const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s().-]{5,}$/;
const URL_LIKE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:[/?#]\S*)?$/i;
const SCHEME = /^(https?):\/\/(\S+)$/i;

/** FR-HDR-04: the link target of a contact text, or null. `@handle` and free text never become a URL. */
export function deriveContactUrl(text: string): string | null {
  const value = text.trim();
  const scheme = SCHEME.exec(value);
  if (scheme) return `${scheme[1]!.toLowerCase()}://${scheme[2]}`;
  if (EMAIL.test(value)) return `mailto:${value}`;
  if (PHONE.test(value) && (value.match(/\d/g)?.length ?? 0) >= 5) return `tel:${value.replace(/[\s().-]/g, '')}`;
  if (URL_LIKE.test(value)) return `https://${value}`;
  return null;
}
