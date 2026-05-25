import { BaseExtractor } from './base';
import type { Page } from 'playwright';

export class DeepSeekExtractor extends BaseExtractor {
    name = 'DeepSeek';
    loginUrl = 'https://platform.deepseek.com/sign_in';
    createKeyUrl = 'https://platform.deepseek.com/api_keys';

    async extract(page: Page): Promise<string> {
        console.log('Waiting for login...');

        // Wait for the API keys page to load (user must log in first)
        // DeepSeek dashboard shows a "Create new API key" button
        await this.waitForSelector(page, 'button:has-text("Create API key")', 60000 * 5);

        console.log('Login detected. Navigating to API keys...');
        await page.goto(this.createKeyUrl);

        // Click "Create API key"
        await page.click('button:has-text("Create API key")');

        // Fill in key name in the modal
        const nameInput = await page.$('input[placeholder*="key"]');
        if (nameInput) {
            await nameInput.fill('LunaOS CLI Auto-Key');
        }

        // Confirm creation
        const confirmBtn = await page.$('button:has-text("Create")');
        if (confirmBtn) {
            await confirmBtn.click();
        }

        // Extract the key — DeepSeek keys start with "sk-"
        await this.waitForSelector(page, '.ant-modal', 10000);

        // Look for the key in input fields or monospace text
        const inputs = await page.$$('input');
        for (const input of inputs) {
            const val = await input.inputValue();
            if (val.startsWith('sk-')) return val;
        }

        // Fallback: look in any code/monospace elements
        const codeElements = await page.$$('code, .font-mono, pre');
        for (const el of codeElements) {
            const text = (await el.textContent()) || '';
            if (text.startsWith('sk-')) return text.trim();
        }

        throw new Error('Could not find API key in the modal.');
    }
}
