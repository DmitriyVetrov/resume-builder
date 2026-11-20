import { expect, it } from 'vitest';
import { deriveContactUrl } from './contact-link';

it.each([
  ['person@example.invalid', 'mailto:person@example.invalid'],
  ['+34 600 123 456', 'tel:+34600123456'],
  ['(555) 010-0199', 'tel:5550100199'],
  ['linkedin.com/in/someone', 'https://linkedin.com/in/someone'],
  ['www.example.invalid', 'https://www.example.invalid'],
  ['https://example.invalid/x', 'https://example.invalid/x'],
  ['HTTP://Example.invalid', 'http://Example.invalid'],
  ['@handle', null],
  ['Paterna, Valencia, Spain', null],
  ['+34600000000 • Paterna, Valencia', null],
  ['12', null],
  ['', null],
  ['javascript:alert(1)', null],
])('C01 %s derives %s', (text, url) => {
  expect(deriveContactUrl(text)).toBe(url);
});
