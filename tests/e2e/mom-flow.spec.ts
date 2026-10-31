import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('AI MoM Generator - Staging UI Flow', () => {

  test('should load the staging application and display header', async ({ page }) => {
    await page.goto('/');

    // Verify Brand title & Header
    await expect(page.locator('.brand-title')).toContainText('AI MoM Generator');
    await expect(page.locator('.hero-title')).toContainText('Meeting Minutes Made Simple');

    // Verify Dropzone is visible
    await expect(page.locator('.dropzone-title')).toContainText('Upload meeting transcript');
  });

  test('should accept transcript file and display file preview', async ({ page }) => {
    await page.goto('/');

    const sampleFilePath = path.resolve('tests/fixtures/sample-short.txt');
    const fileInput = page.locator('input[type="file"]');

    // Upload file
    await fileInput.setInputFiles(sampleFilePath);

    // Verify file preview card
    await expect(page.locator('.file-name')).toContainText('sample-short.txt');
    await expect(page.locator('button.generate-btn')).toBeVisible();
  });

  test('should initiate generation job on form submit', async ({ page }) => {
    await page.goto('/');

    const sampleFilePath = path.resolve('tests/fixtures/sample-short.txt');
    await page.locator('input[type="file"]').setInputFiles(sampleFilePath);

    const generateBtn = page.locator('button.generate-btn');
    await expect(generateBtn).toBeEnabled();
    await generateBtn.click();

    // Verify transition to processing status container
    await expect(page.locator('.processing-container')).toBeVisible({ timeout: 10000 });
  });

});
