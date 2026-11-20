import { describe, expect, it } from 'vitest';
import { analyze } from './layout';
import { serialize, SOURCE_LIMIT } from './serialize';
import { extraction, textRun } from './test/pdfs';

/** IMP-01 A-01…A-08, S-01, S-02: layout analysis and the intermediate text, over hand-made runs. */
const sidebarLeft = () => extraction([
  textRun('Alex Sample', 210, 60, { size: 22, bold: true }),
  textRun('Platform Engineer', 210, 85, { size: 13, bold: true }),
  textRun('CONTACT', 30, 150, { size: 8.5, bold: true }),
  textRun('alex.sample@example.com', 30, 165),
  textRun('Springfield', 30, 177),
  textRun('SKILLS', 30, 400, { size: 8.5, bold: true }),
  textRun('Kubernetes', 30, 415),
  textRun('WORK EXPERIENCE', 210, 130, { size: 11, bold: true }),
  textRun('Ran the platform for twelve', 210, 150),
  textRun('teams across two regions.', 210, 162),
  textRun('Second paragraph.', 210, 190),
  textRun('EDUCATION', 210, 600, { size: 11, bold: true }),
]);
const mirrored = () => extraction(sidebarLeft().runs.map(run => ({ ...run, x: run.x === 30 ? 430 : run.x - 170 })));

describe('layout analysis (ADR-055 §3)', () => {
  it('A-01 one column: no sidebar', () => {
    const analysis = analyze(extraction([textRun('Alex Sample', 50, 60, { size: 22, bold: true }), textRun('A line of body text', 50, 100), textRun('Another line far right', 300, 130)]));
    expect(analysis).toMatchObject({ columns: 1, sidebarSide: null });
    expect(analysis.blocks.every(block => block.column === 'M')).toBe(true);
  });

  it('A-02 left sidebar: two columns, sidebar lines S, main lines M', () => {
    const analysis = analyze(sidebarLeft());
    expect(analysis).toMatchObject({ columns: 2, sidebarSide: 'left' });
    expect(analysis.blocks.find(block => block.plain === 'Kubernetes')?.column).toBe('S');
    expect(analysis.blocks.find(block => block.plain === 'EDUCATION')?.column).toBe('M');
  });

  it('A-03 right sidebar', () => {
    const analysis = analyze(mirrored());
    expect(analysis).toMatchObject({ columns: 2, sidebarSide: 'right' });
    expect(analysis.blocks.find(block => block.plain === 'CONTACT')?.column).toBe('S');
  });

  it('A-04 a full-width header above the columns comes first', () => {
    const runs = [textRun('Alex Sample — Platform Engineer and Site Reliability Lead', 30, 40, { size: 13, bold: true, width: 500 }), ...sidebarLeft().runs.filter(run => run.text !== 'Alex Sample')];
    const analysis = analyze(extraction(runs));
    expect(analysis.columns).toBe(2);
    expect(analysis.blocks[0]!.plain).toBe('Alex Sample — Platform Engineer and Site Reliability Lead');
  });

  it('A-05 order: top to bottom within a column, main before sidebar', () => {
    const order = analyze(sidebarLeft()).blocks.map(block => block.plain);
    expect(order).toEqual(['Alex Sample', 'Platform Engineer', 'WORK EXPERIENCE', 'Ran the platform for twelve teams across two regions.', 'Second paragraph.', 'EDUCATION', 'CONTACT', 'alex.sample@example.com', 'Springfield', 'SKILLS', 'Kubernetes']);
  });

  it('A-06 wrapped lines merge; a larger gap starts a new paragraph', () => {
    const analysis = analyze(sidebarLeft());
    expect(analysis.blocks.filter(block => block.plain.startsWith('Ran the platform'))).toHaveLength(1);
    expect(analysis.blocks.some(block => block.plain === 'Second paragraph.')).toBe(true);
  });

  it('A-07 a list item keeps its continuation lines', () => {
    const analysis = analyze(extraction([textRun('Alex Sample', 50, 60, { size: 22, bold: true }), textRun('• Built the release pipeline that', 50, 100), textRun('every team now uses.', 58, 112), textRun('• Second item.', 50, 124)]));
    expect(analysis.blocks.filter(block => block.listItem).map(block => block.plain)).toEqual(['Built the release pipeline that every team now uses.', 'Second item.']);
  });

  it('A-08 deterministic', () => {
    expect(JSON.stringify(analyze(sidebarLeft()))).toBe(JSON.stringify(analyze(sidebarLeft())));
    expect(serialize(analyze(sidebarLeft())).text).toBe(serialize(analyze(sidebarLeft())).text);
  });

  it('A-09 a heading is a block of its own even without a gap before the next line', () => {
    const analysis = analyze(extraction([textRun('SKILLS', 50, 100, { size: 11, bold: true }), textRun('Kubernetes and Terraform', 50, 112)]));
    expect(analysis.blocks.map(block => block.plain)).toEqual(['SKILLS', 'Kubernetes and Terraform']);
  });

  it('A-10 a glyph in a run of its own marks a list item and does not decide the weight (DD-IMP-27)', () => {
    const analysis = analyze(extraction([
      textRun('●', 50, 100),
      textRun('Platform Engineer | 2024 – Present', 60, 100, { bold: true }),
      textRun('Example Systems · Springfield', 50, 114),
    ]));
    expect(analysis.blocks.map(block => [block.plain, block.text, block.listItem, block.bold])).toEqual([
      ['Platform Engineer | 2024 – Present', 'Platform Engineer | 2024 – Present', true, true],
      ['Example Systems · Springfield', 'Example Systems · Springfield', false, false],
    ]);
  });
});

describe('intermediate text (ADR-055 §3)', () => {
  it('S-01 one line per block with column, weight, style, list and size tags; size only when it differs from the body', () => {
    const lines = serialize(analyze(sidebarLeft())).text.split('\n');
    expect(lines).toContain('[M b 22] Alex Sample');
    expect(lines).toContain('[M b 11] WORK EXPERIENCE');
    expect(lines).toContain('[M] Ran the platform for twelve teams across two regions.');
    expect(lines).toContain('[S b 8.5] CONTACT');
    expect(lines).toContain('[S] Kubernetes');
    const items = serialize(analyze(extraction([textRun('• An item', 50, 100), textRun('Body', 50, 130), textRun('Body two', 50, 160, { italic: true })]))).text.split('\n');
    expect(items).toEqual(['[M li] An item', '[M] Body', '[M i] Body two']);
  });

  it('S-02 the text is capped at the limit on a line boundary and the cap is reported', () => {
    const runs = Array.from({ length: 2200 }, (_, index) => textRun(`Line number ${index} with some padding text`, 50, 20 + (index % 60) * 13, { page: Math.floor(index / 60) }));
    const pages = Array.from({ length: 37 }, () => ({ width: 595.28, height: 841.89 }));
    const { text, capped } = serialize(analyze(extraction(runs, { pages })));
    expect(capped).toBe(true);
    expect(text.length).toBeLessThanOrEqual(SOURCE_LIMIT);
    expect(text.endsWith('text')).toBe(true);
    expect(serialize(analyze(extraction([textRun('Short', 50, 60)]))).capped).toBe(false);
  });
});
