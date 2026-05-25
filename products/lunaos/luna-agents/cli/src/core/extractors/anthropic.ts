import { BaseExtractor } from './base.js';
import type { Page } from 'playwright-core';

export class AnthropicExtractor extends BaseExtractor {
    name = 'Anthropic';
    loginUrl = 'https://console.anthropic.com/login';
    createKeyUrl = 'https://console.anthropic.com/settings/keys';

    async extract(page: Page): Promise<string> {
        console.log('Waiting for login...');

        // Wait for the key creation button or dashboard element
        // Anthropic dashboard has "Create Key" button
        await this.waitForSelector(page, 'button:has-text("Create Key")', 60000 * 5);

        console.log('Login detected. navigating to API keys...');
        await page.goto(this.createKeyUrl);

        // 2. Click "Create Key"
        await page.click('button:has-text("Create Key")');

        // 3. Name the key
        await this.waitForSelector(page, 'input[name="name"]', 5000);
        await page.fill('input[name="name"]', 'LunaOS CLI Auto-Key');

        // 4. Click "Create Key" (submit)
        await page.click('button[type="submit"]');

        // 5. Extract key
        await this.waitForSelector(page, '.font-mono', 10000);

        // Look for text starting with sk-ant-
        const keyElement = await page.$('p:has-text("sk-ant-")');
        if (keyElement) {
            return await keyElement.textContent() || '';
        }

        // Or look for input value
        const input = await page.$('input[value^="sk-ant-"]');
        if (input) return await input.inputValue();

        throw new Error('Could not find API key in the modal.');
    }
}
