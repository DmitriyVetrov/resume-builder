import { fireEvent, screen } from '@testing-library/react';

/** Opens a theme Select (DD-UI-16) from the keyboard; returns its options. */
function open(trigger: HTMLElement) {
  fireEvent.keyDown(trigger, { key: 'Enter' });
  return screen.getAllByRole('option');
}

/** Picks the option whose value is `value`, as `fireEvent.change` did on the native `<select>`. */
export function choose(trigger: HTMLElement, value: string) {
  const option = open(trigger).find(item => item.dataset.value === value);
  if (!option) throw new Error(`No option with the value "${value}"`);
  fireEvent.click(option);
}

/** The options of a theme Select, read from its open list, which is then closed. */
export function optionsOf(trigger: HTMLElement) {
  const options = open(trigger);
  fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
  return options;
}
