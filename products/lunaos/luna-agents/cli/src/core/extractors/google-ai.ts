import { BaseExtractor } from './base';
import type { Page } from 'playwright';

export class GoogleAIExtractor extends BaseExtractor {
    name = 'Google AI (Gemini)';
    loginUrl = 'https://aistudio.google.com/app/apikey';
    createKeyUrl = 'https://aistudio.google.com/app/apikey';

    async extract(page: Page): Promise<string> {
        console.log('Waiting for login...');

        // Google AI Studio shows API keys page directly
        // Wait for the "Create API key" button or an existing key listing
        await this.waitForSelector(
            page,
            'button:has-text("Create API key"), button:has-text("Create API Key")',
            60000 * 5
        );

        console.log('Login detected. On API keys page...');

        // Click "Create API key"
        const createBtn = await page.$('button:has-text("Create API key")') ||
            await page.$('button:has-text("Create API Key")');
        if (createBtn) {
            await createBtn.click();
        }

        // Google may show a project selector — wait a moment
        await page.waitForTimeout(2000);

        // If there's a project selection dialog, pick the first or default
        const projectOption = await page.$('[role="option"], [role="listbox"] li');
        if (projectOption) {
            await projectOption.click();
            await page.waitForTimeout(1000);
        }

        // Confirm creation if needed
        const confirmBtn = await page.$('button:has-text("Create API key in")') ||
            await page.$('button:has-text("Create")');
        if (confirmBtn) {
            await confirmBtn.click();
        }

        // Wait for the key to be displayed
        await page.waitForTimeout(3000);

        // Google AI Studio keys start with "AIza"
        // Look for a copyable key display
        const inputs = await page.$$('input');
        for (const input of inputs) {
            const val = await input.inputValue();
            if (val.startsWith('AIza')) return val;
        }

        // Check text elements
        const codeElements = await page.$$('code, .font-mono, pre, [class*="key"]');
        for (const el of codeElements) {
            const text = (await el.textContent()) || '';
            if (text.startsWith('AIza')) return text.trim();
        }

        // Regex fallback across page body
        const allText = await page.textContent('body') || '';
        const match = allText.match(/AIza[a-zA-Z0-9_-]{30,}/);
        if (match) return match[0];

        throw new Error('Could not find API key. Please copy it manually from the Google AI Studio page.');
    }
}
