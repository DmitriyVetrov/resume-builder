import { describe, expect, it } from 'vitest';
import { COALESCE_MS, EditHistory, HISTORY_LIMIT } from './history';

const start = () => new EditHistory<string, string>('d0', 's0');

describe('document history', () => {
  it('H01 undoes and redoes with labels and restores the document', () => {
    const history = start();
    expect(history.canUndo).toBe(false);
    history.push('d1', 's1', 'Rename', null, 0);
    expect(history.document).toBe('d1');
    expect(history.undoLabel).toBe('Rename');
    expect(history.undo()).toMatchObject({ document: 'd0', label: 'Rename' });
    expect(history.document).toBe('d0');
    expect(history.canUndo).toBe(false);
    expect(history.redoLabel).toBe('Rename');
    expect(history.redo()).toMatchObject({ document: 'd1', selection: 's1' });
    expect(history.canRedo).toBe(false);
    expect(history.undo()).not.toBeNull();
    expect(history.undo()).toBeNull();
  });

  it('H02 coalesces a burst with one key inside the window into one step', () => {
    const history = start();
    history.push('d1', 's', 'Type', 'field', 0);
    history.push('d2', 's', 'Type', 'field', COALESCE_MS - 1);
    history.push('d3', 's', 'Type', 'field', 2 * COALESCE_MS - 2);
    expect(history.undo()?.document).toBe('d0');
    expect(history.canUndo).toBe(false);
    expect(history.redo()?.document).toBe('d3');
  });

  it('H03 starts a new step on another key, on no key, or after the window', () => {
    const history = start();
    history.push('d1', 's', 'Type', 'a', 0);
    history.push('d2', 's', 'Type', 'b', 1);
    history.push('d3', 's', 'Type', 'b', 2 + COALESCE_MS);
    history.push('d4', 's', 'Move', null, 3 + COALESCE_MS);
    history.push('d5', 's', 'Move', null, 4 + COALESCE_MS);
    const seen = [history.undo()?.document, history.undo()?.document, history.undo()?.document, history.undo()?.document, history.undo()?.document];
    expect(seen).toEqual(['d4', 'd3', 'd2', 'd1', 'd0']);
  });

  it('H04 drops the redo branch on a new edit, and undo breaks coalescing', () => {
    const history = start();
    history.push('d1', 's', 'Type', 'a', 0);
    history.undo();
    history.push('d2', 's', 'Type', 'a', 1);
    expect(history.canRedo).toBe(false);
    expect(history.undo()?.document).toBe('d0');
    history.redo();
    history.push('d3', 's', 'Type', 'a', 2);
    expect(history.undo()?.document).toBe('d2');
  });

  it('H05 keeps at least 50 steps and is capped', () => {
    const history = start();
    for (let n = 1; n <= HISTORY_LIMIT + 20; n++) history.push(`d${n}`, 's', 'Step', null, n);
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(50);
    let steps = 0;
    while (history.undo()) steps++;
    expect(steps).toBe(HISTORY_LIMIT);
    expect(history.document).toBe('d20');
  });

  it('H06 restores the selection of the change on undo and on redo', () => {
    const history = start();
    history.setSelection('before');
    history.push('d1', 'after', 'Edit', null, 0);
    history.setSelection('elsewhere');
    expect(history.undo()?.selection).toBe('before');
    expect(history.redo()?.selection).toBe('after');
  });
});
