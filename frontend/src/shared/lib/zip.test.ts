import { describe, expect, it } from 'vitest';
import { blobBytes, text, unzip } from '../../test/unzip';
import { createZip } from './zip';

const MODIFIED = new Date(2026, 10, 12, 14, 30, 58);
const large = Uint8Array.from({ length: 70_000 }, (_, index) => (index * 31) % 251);

describe('store-only ZIP writer (DD-P13-11)', () => {
  it('Z01 an independent reader accepts the archive: names, flags, method, sizes, CRCs and the date', async () => {
    const bytes = await blobBytes(createZip([
      { name: 'account-data.json', data: new TextEncoder().encode('{"a":1}') },
      { name: 'resumes/Резюме-Олена.txt', data: new TextEncoder().encode('Олена Коваленко\n') },
      { name: 'empty.txt', data: new Uint8Array() },
      { name: 'resumes/large.bin', data: large },
    ], MODIFIED));
    const entries = unzip(bytes);
    expect(entries.map(entry => entry.name)).toEqual(['account-data.json', 'resumes/Резюме-Олена.txt', 'empty.txt', 'resumes/large.bin']);
    expect(entries.every(entry => entry.utf8Flag && entry.method === 0)).toBe(true);
    expect(text(entries[0]!.data)).toBe('{"a":1}');
    expect(text(entries[1]!.data)).toBe('Олена Коваленко\n');
    expect(entries[2]!.data).toHaveLength(0);
    expect(entries[3]!.data).toEqual(large);
    // DOS time keeps two-second steps.
    expect(entries[0]!.dosDate).toBe(((2026 - 1980) << 9) | (11 << 5) | 12);
    expect(entries[0]!.dosTime).toBe((14 << 11) | (30 << 5) | (58 / 2));
  });

  it('Z02 no entries give one valid 22-byte end record', async () => {
    const bytes = await blobBytes(createZip([], MODIFIED));
    expect(bytes).toHaveLength(22);
    expect(unzip(bytes)).toEqual([]);
  });

  it('Z03 the same entries and date give the same bytes', async () => {
    const entries = [{ name: 'a.txt', data: new TextEncoder().encode('a') }, { name: 'b/c.bin', data: large }];
    expect(await blobBytes(createZip(entries, MODIFIED))).toEqual(await blobBytes(createZip(entries, MODIFIED)));
  });
});
