import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// DD-P07-16: /resumes calls listResumes now; its heading, deep-link and axe checks moved to library.spec.ts.
// DD-P08-12: the editor calls getResume now; its heading, region, tab, overflow and axe checks moved to editor.spec.ts (E16, E17).
for (const path of ['/', '/missing']) {
  test(`${path} deep link and accessibility`, async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url()); });
    await page.route('**/api/**', route => route.abort());
    await page.goto(path);
    await page.reload();
    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    if (path === '/') await expect(page.getByRole('link', { name: /open your resumes/i })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    if (path === '/missing') {
      await expect(page.getByRole('heading', { name: /not found/i })).toBeVisible();
      await page.getByRole('link', { name: /home/i }).focus();
      await page.keyboard.press('Enter');
      await expect(page).toHaveURL('/');
    }
    expect(apiCalls).toEqual([]);
  });
}
