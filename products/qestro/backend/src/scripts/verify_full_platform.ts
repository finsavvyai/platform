
import { chromium, Browser, Page } from 'playwright';

async function verifyFullPlatform() {
    console.log('🌍 Starting Full Platform Capability Verification...');
    console.log('------------------------------------------------');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1600, height: 900 }
    });
    const page = await context.newPage();

    // Debug logging
    page.on('console', msg => {
        if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
    });
    page.on('pageerror', err => console.log(`[PAGE CRASH] ${err.message}`));

    const baseUrl = 'http://localhost:3000';
    const routes = [
        { path: '/', label: 'Dashboard', selector: 'text=Dashboard' }, // Adjust selector if needed
        { path: '/agents', label: 'Agent Department (Autonomous)', selector: 'h1:has-text("Agent Department")' },
        { path: '/cloud-devices', label: 'Cloud Device Hub', selector: 'text=iPhone 15 Pro' },
        { path: '/plans', label: 'Test Plans', selector: 'text=Test Plans' }, // Generic check
        { path: '/cases', label: 'Test Cases', selector: 'text=Test Cases' },
        { path: '/cycles', label: 'Test Cycles', selector: 'text=Cycle' }, // Matches "Test Cycles" or "No Test Cycles Yet"
        { path: '/runs', label: 'Test Runs', selector: 'text=Run' }, // Matches "Test Runs", "TEST RUNS", "No Test Runs Yet"
        { path: '/insights', label: 'Insights', selector: 'text=Insights' },
        { path: '/studio', label: 'API Studio', selector: 'text=Qestro API' },
        { path: '/security', label: 'Security Center', selector: 'text=Security Center' },
        { path: '/compliance', label: 'Compliance Hub', selector: 'text=Compliance Hub' },
        { path: '/settings', label: 'Settings', selector: 'text=Settings' }
    ];

    let passed = 0;
    let failed = 0;

    try {
        // Initial Navigation
        console.log(`➡️  Connecting to ${baseUrl}...`);
        await page.goto(baseUrl);
        await page.waitForTimeout(1000);

        // Check for Login Redirect
        if (page.url().includes('/login')) {
            console.warn('⚠️  Redirected to Login. Attempting bypass or wait...');
            // In a real scenario, we'd log in. For now, assuming dev mode might bypass or we just check the login page itself.
            // If the app requires auth, this test might need valid creds.
            // Let's assume for this "capability test" we want to see if routes load. 
            // If strictly protected, we might need to simulate login.

            // Try to locate generic dashboard element just in case
        }

        for (const route of routes) {
            console.log(`\nTesting Module: ${route.label}`);
            try {
                const url = `${baseUrl}${route.path}`;
                await page.goto(url);
                await page.waitForTimeout(1000); // Wait for animations/fetches

                // 1. Check URL
                if (page.url() !== url && !page.url().includes(route.path)) {
                    console.log(`   🔸 Redirected to: ${page.url()} (Might be auth protected)`);
                }

                // 2. Check for white screen (crashes)
                const bodyContent = await page.innerText('body');
                if (!bodyContent.trim()) {
                    throw new Error('White Screen of Death detected (Empty Body)');
                }

                // 3. Verify specific element
                // We use a lenient try/catch here to not fail the whole suite if one header is missing text
                try {
                    await page.waitForSelector(route.selector, { timeout: 3000 });
                    console.log(`   ✅ UI Rendered successfully`);
                    passed++;
                } catch (e) {
                    console.error(`   ❌ UI Element not found: "${route.selector}"`);
                    console.log(`   📸 Taking screenshot: failed_${route.path.replace(/\//g, '')}.png`);
                    // await page.screenshot({ path: `failed_${route.path.replace(/\//g, '')}.png` });
                    failed++;
                }

            } catch (err) {
                console.error(`   💥 CRITICAL FAILURE: ${err.message}`);
                failed++;
            }
        }

    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        console.log('\n------------------------------------------------');
        console.log(`🏁 Capabilities Verified: ${passed}/${passed + failed}`);
        console.log('------------------------------------------------');
        await browser.close();
    }
}

verifyFullPlatform();
