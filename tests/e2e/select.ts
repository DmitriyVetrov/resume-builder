import type { Locator } from '@playwright/test';

/**
 * Picks the option with this value in a theme Select (DD-UI-16), as `selectOption` did on the native
 * `<select>`: the trigger and each option carry `data-value`.
 */
export async function choose(combobox: Locator, value: string) {
  await combobox.click();
  await combobox.page().getByRole('listbox').locator(`[role="option"][data-value="${value}"]`).click();
}
