import base from './playwright.config';
import { defineConfig } from '@playwright/test';

export default defineConfig({ ...base, testMatch: ['bench-editor.spec.ts'], workers: 1 });
