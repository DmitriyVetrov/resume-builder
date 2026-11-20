// The contract's `SafeUrl` pattern, which names control characters on purpose.
// eslint-disable-next-line no-control-regex
const SAFE_URL = /^(?:https?:\/\/|mailto:|tel:)[^\s\x00-\x1F\x7F-\x9F]+$/;
const ANY_SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const ALLOWED = new Set(['https', 'http', 'mailto', 'tel']);
const EMAIL = /^[^\s@:/]+@[^\s@:/]+\.[^\s@:/]+$/;
const PHONE = /^\+?[\d\s().-]{5,}$/;
const DOMAIN_LIKE = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;
const URL_LIMIT = 2048;

/** R-6: the contract's `SafeUrl`, the only URL rule (lower-case scheme, no whitespace or control characters, ≤ 2048). */
export function isSafeUrl(value: string): boolean {
  return Array.from(value).length <= URL_LIMIT && SAFE_URL.test(value);
}

/** What a user typed as a link target → a `SafeUrl`, or null when it cannot be one (DD-P09-06, C-10). */
export function normalizeUrl(input: string): string | null {
  const value = input.trim();
  if (!value) return null;
  if (DOMAIN_LIKE.test(value)) return check(`https://${value}`);
  const scheme = ANY_SCHEME.exec(value);
  if (scheme) {
    const name = scheme[1]!.toLowerCase();
    return ALLOWED.has(name) ? check(name + value.slice(name.length)) : null;
  }
  if (EMAIL.test(value)) return check(`mailto:${value}`);
  if (PHONE.test(value)) return check(`tel:${value.replace(/[\s().-]/g, '')}`);
  return null;
}

const check = (url: string) => isSafeUrl(url) ? url : null;
