import { existsSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../..');
const tool = resolve(root, 'tests/contract/node_modules/.bin/openapi-typescript');
if (!existsSync(tool)) execFileSync('npm', ['ci', '--prefix', resolve(root, 'tests/contract'), '--ignore-scripts', '--no-audit', '--no-fund'], { stdio: 'inherit' });
const output = resolve(root, 'frontend/src/shared/api/generated/schema.d.ts');
mkdirSync(resolve(root, 'frontend/src/shared/api/generated'), { recursive: true });
execFileSync(tool, [resolve(root, 'contracts/openapi/openapi.yaml'), '--output', output], { stdio: 'inherit' });
