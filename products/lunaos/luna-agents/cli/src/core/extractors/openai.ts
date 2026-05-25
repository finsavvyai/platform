import { BaseExtractor } from './base.js';
import type { Page } from 'playwright-core';

export class OpenAIExtractor extends BaseExtractor {
    name = 'OpenAI';
    loginUrl = 'https://platform.openai.com/login';
    createKeyUrl = 'https://platform.openai.com/api-keys';

    async extract(page: Page): Promise<string> {
        // 1. Wait for user to log in and reach the dashboard
        // We look for an element that exists only when logged in, e.g., the user menu or "Create new secret key" button
        console.log('Waiting for login...');

        // Wait for the "Create new secret key" button to be visible
        // This button usually has text "Create new secret key"
        await this.waitForSelector(page, 'button:has-text("Create new secret key")', 60000 * 5); // 5 min timeout for login

        console.log('Login detected. Navigating to API keys...');
        await page.goto(this.createKeyUrl); // Ensure we are on the right page

        // 2. Click "Create new secret key"
        await page.click('button:has-text("Create new secret key")');

        // 3. Fill in name (optional) - "LunaOS CLI"
        // Wait for modal
        await this.waitForSelector(page, 'input[placeholder="My Test Key"]', 5000);
        // Or generic input inside modal
        await page.fill('input[placeholder="My Test Key"]', 'LunaOS CLI Auto-Key');

        // 4. Click "Create secret key"
        await page.click('button:has-text("Create secret key")');

        // 5. Extract the key
        // The key is shown in an input or a code block
        await this.waitForSelector(page, '.text-input-copy-button', 10000);

        // Usually the key starts with sk-...
        // Try to find the input value
        const keyInput = await page.$('input[value^="sk-"]');
        if (keyInput) {
            return await keyInput.inputValue();
        }

        // Fallback: copy to clipboard? 
        // Or look for text content starting with sk-
        // OpenAI puts it in a readonly input
        const inputs = await page.$$('input');
        for (const input of inputs) {
            const val = await input.inputValue();
            if (val.startsWith('sk-')) return val;
        }

        throw new Error('Could not find API key in the modal.');
    }
}
