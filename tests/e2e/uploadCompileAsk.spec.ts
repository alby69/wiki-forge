import fs from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';

const rawName = `e2e-flow-${process.pid}.md`;
const uploadedName = `e2e-flow-${process.pid}.txt`;
const uploadedPath = path.resolve(process.cwd(), 'wiki/sources', uploadedName);
const rawPath = path.resolve(process.cwd(), 'raw', rawName);
const compiledRawPath = path.resolve(
  process.cwd(),
  'raw',
  rawName.replace(/\.md$/i, '_COMPILED.md')
);
const notePath = path.resolve(
  process.cwd(),
  'wiki/general',
  rawName.replace(/\.md$/i, '.md')
);

const wikiRoot = path.resolve(process.cwd(), 'wiki');
const generatedIndexes = [
  path.join(wikiRoot, 'index.md'),
  path.join(wikiRoot, 'general', 'index.md'),
  path.join(wikiRoot, 'sources', 'index.md'),
];
const generatedDirs = [
  path.join(wikiRoot, 'sources'),
  path.join(wikiRoot, 'general'),
  wikiRoot,
];
const indexBackups = new Map<string, Buffer>();
const existingDirs = new Set<string>();

async function exists(target: string): Promise<boolean> {
  return fs.stat(target).then(() => true, () => false);
}

test.beforeAll(async () => {
  for (const target of generatedIndexes) {
    if (await exists(target)) indexBackups.set(target, await fs.readFile(target));
  }
  for (const target of generatedDirs) {
    if (await exists(target)) existingDirs.add(target);
  }
});

test.afterAll(async () => {
  for (const target of [uploadedPath, rawPath, compiledRawPath, notePath]) {
    await fs.rm(target, { force: true });
  }
  for (const target of generatedIndexes) {
    const backup = indexBackups.get(target);
    if (backup) await fs.writeFile(target, backup);
    else await fs.rm(target, { force: true });
  }
  for (const target of generatedDirs) {
    if (!existingDirs.has(target)) await fs.rmdir(target).catch(() => undefined);
  }
});

test('Carica → Compila → Chiedi', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wiki-forge:onboarding-completed', 'true');
  });
  await page.goto('/');
  await expect(page.locator('[data-role="login-overlay"]')).toBeVisible();
  await page.locator('[data-role="login-username"]').fill('e2e-admin');
  await page.locator('[data-role="login-password"]').fill('E2EPassword!2026');
  await page.locator('[data-role="login-submit"]').click();
  await expect(page.locator('[data-role="login-overlay"]')).toBeHidden();

  const wizard = page.locator('#onboarding-wizard-modal');
  if (await wizard.isVisible()) {
    await page.locator('#wizard-close-btn').click();
    await expect(wizard).toBeHidden();
  }

  await expect(page.locator('#focus-upload-btn')).toBeVisible();
  await page.locator('#focus-upload-btn').click();
  await expect(page.locator('#dropzone-file-input')).toBeAttached();
  await page.locator('#dropzone-file-input').setInputFiles({
    name: uploadedName,
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Sorgente E2E\n\nDocumento caricato dal flusso end-to-end.'),
  });
  await expect(page.locator('#dropzone-container-root')).toContainText('uploaded and ready');
  await expect.poll(async () => fs.access(uploadedPath).then(() => true, () => false)).toBe(true);
  await page.locator('#dropzone-close-btn').click();

  await fs.mkdir(path.dirname(rawPath), { recursive: true });
  await fs.writeFile(rawPath, '# Sorgenteraw E2E\n\nDa compilare con il mock LLM.', 'utf-8');

  await page.locator('#focus-compile-btn').click();
  await expect(page.locator('#simple-compile-btn, #focus-compile-btn').first()).toBeVisible();
  await expect.poll(async () => fs.access(notePath).then(() => true, () => false)).toBe(true);

  await page.locator('#focus-ask-btn').click();
  await expect(page.locator('#chat-input')).toBeVisible();
  await page.locator('#chat-input').fill('La wiki è pronta?');
  await page.locator('#chat-send-btn').click();
  await expect(page.locator('#chat-messages-list')).toContainText('Risposta E2E: la wiki è pronta.');
});
