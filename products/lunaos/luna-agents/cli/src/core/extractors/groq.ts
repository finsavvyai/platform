import { BaseExtractor } from './base';
import type { Page } from 'playwright';

export class GroqExtractor extends BaseExtractor {
    name = 'Groq';
    loginUrl = 'https://console.groq.com/login';
    createKeyUrl = 'https://console.groq.com/keys';

    async extract(page: Page): Promise<string> {
        console.log('Waiting for login...');

        // Wait for the keys page to load after login
        // Groq console shows "Create API Key" button
        await this.waitForSelector(page, 'button:has-text("Create API Key")', 60000 * 5);

        console.log('Login detected. Navigating to API keys...');
        await page.goto(this.createKeyUrl);

        // Click "Create API Key"
        await page.click('button:has-text("Create API Key")');

        // Fill in key name in the dialog
        await this.waitForSelector(page, 'input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]', 5000);

        const nameInput = await page.$('input[name="name"]') || await page.$('input[placeholder*="name"]');
        if (nameInput) {
            await nameInput.fill('LunaOS CLI Auto-Key');
        }

        // Submit the form
        const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Submit")');
        if (submitBtn) {
            await submitBtn.click();
        }

        // Extract the key — Groq keys start with "gsk_"
        await this.waitForSelector(page, '[role="dialog"], .modal', 10000);

        // Look for the key in input fields
        const inputs = await page.$$('input');
        for (const input of inputs) {
            const val = await input.inputValue();
            if (val.startsWith('gsk_')) return val;
        }

        // Fallback: scan monospace text elements
        const codeElements = await page.$$('code, .font-mono, pre, [class*="mono"]');
        for (const el of codeElements) {
            const text = (await el.textContent()) || '';
            if (text.startsWith('gsk_')) return text.trim();
        }

        // Last resort: look at all visible text
        const allText = await page.textContent('body') || '';
        const match = allText.match(/gsk_[a-zA-Z0-9]+/);
        if (match) return match[0];

        throw new Error('Could not find API key in the modal.');
    }
}
