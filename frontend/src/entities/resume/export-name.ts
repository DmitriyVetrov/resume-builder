/**
 * FR-PDF-06, DD-P12-05: letters, digits, `-`, `_`, `.`; whitespace becomes `-`. Marks stay with their letters. A title cannot
 * make a path step or a hidden file, and one with no letter or digit left falls back. Runtime Unicode data is fine here: the name is not part of the file's bytes.
 */
export function exportFileName(title: string, extension: 'pdf' | 'txt'): string {
  const kept = title.trim().replace(/\s/gu, '-').replace(/[^\p{L}\p{N}\p{M}\-_.]/gu, '').replace(/^\.+|\.+$/g, '');
  const name = /[\p{L}\p{N}]/u.test(kept) ? kept : 'resume';
  return name.toLowerCase().endsWith(`.${extension}`) ? name : `${name}.${extension}`;
}
