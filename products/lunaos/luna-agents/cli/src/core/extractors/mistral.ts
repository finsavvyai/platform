import { BaseExtractor } from './base';
import type { Page } from 'playwright';

export class MistralExtractor extends BaseExtractor {
    name = 'Mistral AI';
    loginUrl = 'https://console.mistral.ai/';
    createKeyUrl = 'https://console.mistral.ai/api-keys/';

    async extract(page: Page): Promise<string> {
        console.log('Waiting for login...');

        // Wait for the API keys page to load after login
        // Mistral console shows "Create new key" button
        await this.waitForSelector(
            page,
            'button:has-text("Create new key"), button:has-text("Create API key"), button:has-text("Create Key")',
            60000 * 5
        );

        console.log('Login detected. Navigating to API keys...');
        await page.goto(this.createKeyUrl);

        // Click the create button
        const createBtn = await page.$('button:has-text("Create new key")') ||
            await page.$('button:has-text("Create API key")') ||
            await page.$('button:has-text("Create Key")');
        if (createBtn) {
            await createBtn.click();
        }

        // Fill in key name
        await this.waitForSelector(page, 'input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]', 5000);
        const nameInput = await page.$('input[name="name"]') || await page.$('input[placeholder*="name"]');
        if (nameInput) {
            await nameInput.fill('LunaOS CLI Auto-Key');
        }

        // Submit
        const submitBtn = await page.$('button[type="submit"]') ||
            await page.$('button:has-text("Create")');
        if (submitBtn) {
            await submitBtn.click();
        }

        // Wait for the key to be displayed
        await this.waitForSelector(page, '[role="dialog"], .modal, [class*="modal"]', 10000);

        // Look for the key — Mistral keys are UUIDs or long alphanumeric strings
        const inputs = await page.$$('input');
        for (const input of inputs) {
            const val = await input.inputValue();
            // Mistral keys are typically long alphanumeric strings
            if (val.length > 20 && /^[a-zA-Z0-9]+$/.test(val)) return val;
        }

        // Check code/mono elements
        const codeElements = await page.$$('code, .font-mono, pre');
        for (const el of codeElements) {
            const text = (await el.textContent()) || '';
            const trimmed = text.trim();
            if (trimmed.length > 20 && /^[a-zA-Z0-9]+$/.test(trimmed)) return trimmed;
        }

        throw new Error('Could not find API key in the modal.');
    }
}
