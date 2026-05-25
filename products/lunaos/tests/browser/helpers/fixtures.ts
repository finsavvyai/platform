import { test as base, expect, type Page } from '@playwright/test';
import { installLunaApiMocks, type MockApiOptions } from './mock-apis';

type Fixtures = {
    mockedPage: Page;
    mockApiOptions: MockApiOptions;
};

export const test = base.extend<Fixtures>({
    mockApiOptions: [{}, { option: true }],
    mockedPage: async ({ page, mockApiOptions }, use) => {
        await installLunaApiMocks(page, mockApiOptions);
        await page.addInitScript(() => {
            (window as any).localStorage.setItem(
                'luna.session',
                JSON.stringify({ token: 'test_jwt', userId: 'user_test_1' }),
            );
        });
        await use(page);
    },
});

export { expect };
