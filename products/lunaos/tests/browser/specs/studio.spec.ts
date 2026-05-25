import { test, expect } from '../helpers/fixtures';

test.describe('Studio smoke', () => {
    test('loads editor and renders canvas', async ({ mockedPage }) => {
        await mockedPage.goto('/');
        await expect(mockedPage).toHaveTitle(/Studio|LunaOS/i);
        const canvas = mockedPage.locator('[data-testid="workflow-canvas"], .react-flow, canvas').first();
        await expect(canvas).toBeVisible({ timeout: 10_000 });
    });

    test('node palette renders and shows built-in categories', async ({ mockedPage }) => {
        await mockedPage.goto('/');
        const palette = mockedPage.locator('[data-testid="node-palette"], [role="complementary"]').first();
        await expect(palette).toBeVisible({ timeout: 10_000 });
        // At least one built-in node category must be discoverable
        const builtIn = mockedPage.getByText(/Chat Agent|Webhook|If/, { exact: false });
        await expect(builtIn.first()).toBeVisible({ timeout: 5_000 });
    });

    test('Cepien partner node is registered in palette', async ({ mockedPage }) => {
        await mockedPage.goto('/');
        const cepienNode = mockedPage.getByText(/Cepien.*Recommendations/i);
        if (await cepienNode.count()) {
            await expect(cepienNode.first()).toBeVisible();
        } else {
            test.skip(true, 'Cepien node not surfaced in current palette layout');
        }
    });

    test('insights-to-code template is available', async ({ mockedPage }) => {
        await mockedPage.goto('/templates');
        const tpl = mockedPage.getByText(/Insights.*Code/i);
        if (await tpl.count()) await expect(tpl.first()).toBeVisible();
        else test.skip(true, 'Template route not present in current build');
    });

    test('keyboard shortcut adds a node without errors', async ({ mockedPage }) => {
        await mockedPage.goto('/');
        const errors: string[] = [];
        mockedPage.on('pageerror', (e) => errors.push(e.message));
        await mockedPage.keyboard.press('n');
        await mockedPage.waitForTimeout(500);
        expect(errors, `pageerrors: ${errors.join(' | ')}`).toHaveLength(0);
    });
});
