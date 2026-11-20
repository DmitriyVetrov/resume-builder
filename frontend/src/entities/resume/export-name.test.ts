// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { exportFileName } from './export-name';

describe('export file name, FR-PDF-06, DD-P12-05', () => {
  it('F01 keeps the dashes of the spec example', () => {
    expect(exportFileName('SWE-Dmytro-Vietrov', 'pdf')).toBe('SWE-Dmytro-Vietrov.pdf');
    expect(exportFileName('SWE-Dmytro-Vietrov', 'txt')).toBe('SWE-Dmytro-Vietrov.txt');
  });
  it('F02 turns each whitespace character into a dash', () => {
    expect(exportFileName('My resume 2026', 'pdf')).toBe('My-resume-2026.pdf');
    expect(exportFileName('a\tb c', 'pdf')).toBe('a-b-c.pdf');
  });
  it('F03 keeps Unicode letters, digits, marks, underscore and dot', () => {
    expect(exportFileName('Резюме Лусія', 'pdf')).toBe('Резюме-Лусія.pdf');
    expect(exportFileName('Ñáñez_v1.2', 'pdf')).toBe('Ñáñez_v1.2.pdf');
    expect(exportFileName('Андрій', 'txt')).toBe('Андрій.txt');
    expect(exportFileName('Андрий', 'pdf')).toBe('Андрий.pdf');
  });
  it('F04 drops everything else', () => {
    expect(exportFileName('a/b\\c:d*e?f"g<h>i|j', 'pdf')).toBe('abcdefghij.pdf');
    expect(exportFileName('CV (final), v2 • 😀', 'pdf')).toBe('CV-final-v2--.pdf');
  });
  it('F05 cannot make a path step or a hidden file', () => {
    expect(exportFileName('../../etc/passwd', 'pdf')).toBe('etcpasswd.pdf');
    expect(exportFileName('.hidden', 'txt')).toBe('hidden.txt');
    expect(exportFileName('name...', 'pdf')).toBe('name.pdf');
  });
  it('F06 falls back when nothing is left', () => {
    for (const title of ['', '   ', '!!!', '...', '---', ' _ ', '😀']) expect(exportFileName(title, 'pdf')).toBe('resume.pdf');
  });
  it('F07 drops controls and bidi overrides', () => {
    expect(exportFileName('cv‮fdp.exe', 'pdf')).toBe('cvfdp.exe.pdf');
    expect(exportFileName('a\u0000b​c', 'txt')).toBe('abc.txt');
  });
  it('F08 does not double the extension', () => {
    expect(exportFileName('CV.pdf', 'pdf')).toBe('CV.pdf');
    expect(exportFileName('CV.PDF', 'pdf')).toBe('CV.PDF');
    expect(exportFileName('CV.pdf', 'txt')).toBe('CV.pdf.txt');
  });
});
