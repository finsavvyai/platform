import { chromium } from 'playwright';

async function debugDashboard() {
    console.log('🚀 Debugging Dashboard State...');
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    const baseUrl = 'http://localhost:3000';

    try {
        await page.goto(baseUrl);
        await page.waitForTimeout(1000); // Wait for load

        const bodyText = await page.textContent('body');
        console.log('Page Content Preview:', bodyText?.substring(0, 500));

        const emptyStateText = await page.isVisible('text=Welcome to Qestro');
        if (emptyStateText) {
            console.log('⚠️ DETECTED: Page is in "EmptyState" mode (Welcome to Qestro).');
            console.log('   Reason: currentProject.id === "1".');
            console.log('   Action: We need to switch projects or mock the context to see the full dashboard.');
        } else {
            console.log('ℹ️ Page is NOT in EmptyState.');
        }

    } catch (err) {
        console.error('Debug Error:', err);
    } finally {
        await browser.close();
    }
}

debugDashboard();
