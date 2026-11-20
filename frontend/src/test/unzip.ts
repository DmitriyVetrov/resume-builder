import { crc32 } from 'node:zlib';

export type UnzippedEntry = { name: string; data: Uint8Array; utf8Flag: boolean; method: number; dosTime: number; dosDate: number };

/** Tests only. A reader written from APPNOTE 4.3 that trusts nothing: every CRC is checked with Node's own crc32. */
export function unzip(bytes: Uint8Array): UnzippedEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) throw new Error('No end of central directory record (archive comments are not expected)');
  const count = view.getUint16(end + 10, true);
  if (view.getUint16(end + 8, true) !== count) throw new Error('Entry counts differ');
  const size = view.getUint32(end + 12, true);
  let at = view.getUint32(end + 16, true);
  if (at + size !== end) throw new Error('The central directory does not end where the end record starts');
  const entries: UnzippedEntry[] = [];
  for (let index = 0; index < count; index++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error(`Bad central header ${index}`);
    const flags = view.getUint16(at + 8, true);
    const method = view.getUint16(at + 10, true);
    const dosTime = view.getUint16(at + 12, true);
    const dosDate = view.getUint16(at + 14, true);
    const crc = view.getUint32(at + 16, true);
    const compressed = view.getUint32(at + 20, true);
    const plain = view.getUint32(at + 24, true);
    const nameLength = view.getUint16(at + 28, true);
    const extra = view.getUint16(at + 30, true);
    const comment = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(at + 46, at + 46 + nameLength));
    if (view.getUint32(local, true) !== 0x04034b50) throw new Error(`Bad local header for ${name}`);
    if (view.getUint32(local + 14, true) !== crc || view.getUint32(local + 18, true) !== compressed || view.getUint32(local + 22, true) !== plain) throw new Error(`Local and central headers differ for ${name}`);
    const localName = new TextDecoder().decode(bytes.subarray(local + 30, local + 30 + view.getUint16(local + 26, true)));
    if (localName !== name) throw new Error(`Local name differs for ${name}`);
    if (method !== 0 || compressed !== plain) throw new Error(`Unexpected method ${method} for ${name}`);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = bytes.slice(start, start + plain);
    if (crc32(data) !== crc) throw new Error(`CRC mismatch for ${name}`);
    entries.push({ name, data, utf8Flag: (flags & 0x0800) !== 0, method, dosTime, dosDate });
    at += 46 + nameLength + extra + comment;
  }
  return entries;
}

export const blobBytes = (blob: Blob) => new Promise<Uint8Array>((done, fail) => {
  const reader = new FileReader();
  reader.onload = () => done(new Uint8Array(reader.result as ArrayBuffer));
  reader.onerror = () => fail(reader.error);
  reader.readAsArrayBuffer(blob);
});

export const text = (data: Uint8Array) => new TextDecoder().decode(data);
