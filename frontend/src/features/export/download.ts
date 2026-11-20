const REVOKE_AFTER_MS = 30_000;

/** One click, one file (FR-PDF-01): a string goes in as UTF-8 with no BOM. Nothing leaves the browser (ADR-010). */
export function saveFile(content: Uint8Array | string | Blob, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
