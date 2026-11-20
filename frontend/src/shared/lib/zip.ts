export type ZipEntry = { name: string; data: Uint8Array };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date and time, local, in two-second steps (APPNOTE 4.4.6). */
function dosStamp(date: Date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

const UTF8_NAMES = 0x0800;
const VERSION = 20;

/**
 * DD-P13-11: a store-only ZIP (method 0) with UTF-8 names. PDFs and images are compressed already, so deflate would gain
 * little, and this adds nothing to the supply chain. The archive stays under 4 GB and 65 535 entries by the account limits,
 * so there is no ZIP64. The same entries and date give the same bytes.
 */
export function createZip(entries: ZipEntry[], modified: Date): Blob {
  const encoder = new TextEncoder();
  const stamp = dosStamp(modified);
  const parts: BlobPart[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;
    const local = new Uint8Array(30 + name.length);
    const head = new DataView(local.buffer);
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, VERSION, true);
    head.setUint16(6, UTF8_NAMES, true);
    head.setUint16(8, 0, true);
    head.setUint16(10, stamp.time, true);
    head.setUint16(12, stamp.date, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, size, true);
    head.setUint32(22, size, true);
    head.setUint16(26, name.length, true);
    head.setUint16(28, 0, true);
    local.set(name, 30);
    parts.push(local as BlobPart, entry.data as BlobPart);

    const record = new Uint8Array(46 + name.length);
    const view = new DataView(record.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, VERSION, true);
    view.setUint16(6, VERSION, true);
    view.setUint16(8, UTF8_NAMES, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, stamp.time, true);
    view.setUint16(14, stamp.date, true);
    view.setUint32(16, crc, true);
    view.setUint32(20, size, true);
    view.setUint32(24, size, true);
    view.setUint16(28, name.length, true);
    // Extra, comment, disk, internal and external attributes stay 0.
    view.setUint32(42, offset, true);
    record.set(name, 46);
    central.push(record);
    offset += local.length + size;
  }
  const directorySize = central.reduce((sum, record) => sum + record.length, 0);
  const end = new Uint8Array(22);
  const tail = new DataView(end.buffer);
  tail.setUint32(0, 0x06054b50, true);
  tail.setUint16(8, entries.length, true);
  tail.setUint16(10, entries.length, true);
  tail.setUint32(12, directorySize, true);
  tail.setUint32(16, offset, true);
  return new Blob([...parts, ...central as BlobPart[], end as BlobPart], { type: 'application/zip' });
}
