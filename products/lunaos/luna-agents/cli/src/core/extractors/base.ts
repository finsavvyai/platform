import type { Page } from 'playwright-core';

export interface KeyExtractor {
    name: string;
    loginUrl: string;
    createKeyUrl: string;

    /**
     * Extracts the API key from the provider's dashboard using the given Playwright page.
     * The page will be navigated to createKeyUrl before calling this method.
     */
    extract(page: Page): Promise<string>;
}

export abstract class BaseExtractor implements KeyExtractor {
    abstract name: string;
    abstract loginUrl: string;
    abstract createKeyUrl: string;

    async extract(page: Page): Promise<string> {
        throw new Error('Method not implemented.');
    }

    protected async waitForSelector(page: Page, selector: string, timeout = 30000): Promise<void> {
        try {
            await page.waitForSelector(selector, { state: 'visible', timeout });
        } catch (error) {
            throw new Error(`Timeout waiting for element: ${selector}`);
        }
    }
}
