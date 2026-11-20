import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** DD-P13-18. The web image and `vite preview` serve one policy, so the fixture E2E suite runs under what production sends. */
const POLICY = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'";
const root = resolve(import.meta.dirname, '../..');

describe('Content-Security-Policy (AC-P13-11)', () => {
  it('C04 nginx and vite preview send the same policy, the one decided', () => {
    const nginx = readFileSync(resolve(root, 'nginx.conf'), 'utf8');
    const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
    const fromNginx = /add_header Content-Security-Policy "([^"]+)" always;/.exec(nginx)?.[1];
    expect(fromNginx).toBe(POLICY);
    expect(vite).toContain(`'Content-Security-Policy': "${POLICY}"`);
  });
});
