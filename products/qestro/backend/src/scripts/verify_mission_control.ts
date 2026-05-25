import { chromium } from 'playwright';

async function verifyMissionControl() {
    console.log('🚀 Starting Mission Control Verification...');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    // Add Console Listener
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('[ERROR]')) {
            console.log(`[BROWSER ERROR] ${msg.text()}`);
        }
    });

    page.on('pageerror', err => {
        console.log(`[BROWSER EXCEPTION] ${err}`);
    });

    try {
        // 1. Navigate to Mission Control
        console.log('➡️  Navigating to Mission Control...');
        await page.goto('http://localhost:3000/mission-control');

        // Wait for network idle to ensure React hydration
        try {
            await page.waitForLoadState('networkidle', { timeout: 5000 });
        } catch (e) {
            console.log('⚠️  Network idle timeout, proceeding with checks...');
        }

        // 2. Check Header
        console.log('🔍 Verifying Header...');
        const header = await page.textContent('h1');
        if (header?.includes('Mission Control')) {
            console.log('   ✅ Header Verified');
        } else {
            throw new Error(`Header mismatch. Found: "${header}"`);
        }

        // 3. Check Tabs
        console.log('🔍 Verifying Command Interface Tabs...');
        const tabs = await page.$$eval('button', buttons => buttons.map(b => b.textContent));
        const expectedTabs = ['Ingest Ticket', 'Deploy Scout', 'Onboard Repo'];
        const foundTabs = expectedTabs.every(t => tabs.some(tab => tab?.includes(t)));

        if (foundTabs) {
            console.log('   ✅ Tabs Verified');
        } else {
            console.log('FOUND TABS:', tabs);
            throw new Error('Missing expected tabs');
        }

        // 4. Verify Active Missions List
        console.log('🔍 Verifying Active Missions...');
        await page.waitForSelector('text=ACTIVE MANDATES');
        const missions = await page.$$eval('h4', headings => headings.map(h => h.textContent));
        if (missions.length > 0) {
            console.log(`   ✅ Found ${missions.length} active missions: ${missions[0]}...`);
        } else {
            throw new Error('No missions found in list');
        }

        // 5. Test Interaction (Switch Tab)
        console.log('🔍 Testing Interactions...');
        await page.click('text=Deploy Scout');
        const placeholder = await page.getAttribute('textarea', 'placeholder');
        if (placeholder?.includes('https://staging.myapp.com')) {
            console.log('   ✅ Tab Switch Successful (Placeholder updated)');
        } else {
            throw new Error(`Tab switch failed. Placeholder: "${placeholder}"`);
        }

        console.log('------------------------------------------------');
        console.log('✅ MISSION CONTROL VERIFICATION PASSED');
        console.log('------------------------------------------------');

    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error);
        await page.screenshot({ path: 'mission_control_failure.png' });
        process.exit(1);
    } finally {
        await browser.close();
    }
}

verifyMissionControl();
