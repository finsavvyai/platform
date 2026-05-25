import { chromium } from 'playwright';

async function verifyIntegrations() {
    console.log('🚀 Verifying Integrations Ecosystem Hub...');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    const baseUrl = 'http://localhost:3000';

    try {
        console.log('1. Navigating to /integrations...');
        await page.goto(`${baseUrl}/integrations`);
        await page.waitForTimeout(1000);

        const heading = await page.textContent('h1');
        if (heading?.includes('Integrations Ecosystem')) {
            console.log('   ✅ Page loaded successfully.');
        } else {
            console.error('   ❌ Page header mismatch:', heading);
        }

        console.log('2. Verifying Plugin Cards...');
        const cards = await page.locator('.group.relative');
        const count = await cards.count();
        console.log(`   ℹ️ Found ${count} integration cards.`);

        if (count >= 12) {
            console.log('   ✅ All 12 built-in plugins are rendered.');
        } else {
            console.warn('   ⚠️ Card count is lower than expected (12).');
        }

        console.log('3. Testing "Slack" Connection flow...');
        // Find Slack card by checking heading text inside the card
        const slackCard = page.locator('.group', { hasText: 'Slack' }).first();

        if (await slackCard.isVisible()) {
            const connectBtn = slackCard.locator('button', { hasText: 'Connect' });
            if (await connectBtn.isVisible()) {
                await connectBtn.click();
                console.log('   ℹ️ Clicked Connect on Slack...');

                // Wait for mock network delay (1.5s in registry.ts)
                await page.waitForTimeout(2000);

                const activeBadge = slackCard.locator('text=Active');
                if (await activeBadge.isVisible()) {
                    console.log('   ✅ Slack is now ACTIVE.');
                } else {
                    console.error('   ❌ Slack did not switch to active state.');
                }

                // Test Persistence (Reload)
                console.log('   ℹ️ Reloading page to test persistence...');
                await page.reload();
                await page.waitForTimeout(1000);
                if (await page.locator('.group', { hasText: 'Slack' }).first().locator('text=Active').isVisible()) {
                    console.log('   ✅ Persistence confirmed: Slack is still ACTIVE.');
                } else {
                    console.error('   ❌ Persistence failed.');
                }

            } else {
                // Might already be connected from previous run
                const manageBtn = slackCard.locator('button', { hasText: 'Manage' });
                if (await manageBtn.isVisible()) {
                    console.log('   ℹ️ Slack was already connected. Testing disconnect...');
                    page.on('dialog', dialog => dialog.accept()); // Accept confirm alert
                    await manageBtn.click();
                    await page.waitForTimeout(1000); // 800ms delay in code
                    if (await slackCard.locator('button', { hasText: 'Connect' }).isVisible()) {
                        console.log('   ✅ Disconnect successful.');
                    }
                }
            }
        } else {
            console.error('   ❌ Slack card not found.');
        }

    } catch (err) {
        console.error('Test Error:', err);
    } finally {
        await browser.close();
    }
}

verifyIntegrations();
