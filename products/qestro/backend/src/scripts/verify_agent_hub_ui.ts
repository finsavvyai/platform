
import { chromium } from 'playwright';

async function verifyAgentHub() {
    console.log('🕵️♀️ Starting Agent Hub UI Verification (Debug Mode v2)...');

    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    try {
        const targetUrl = 'http://localhost:3000/agents';
        console.log(`➡️  Navigating to ${targetUrl}...`);

        await page.goto(targetUrl);
        await page.waitForTimeout(3000);

        const currentUrl = page.url();
        const title = await page.title();
        console.log(`📍 Current URL: ${currentUrl}`);
        console.log(`📄 Page Title: ${title}`);

        // 2. Verify Page Title
        console.log('👀 Verifying Header...');
        try {
            await page.waitForSelector('h1:has-text("Agent Department")', { timeout: 10000 });
            console.log('✅ Header "Agent Department" found.');
        } catch (e) {
            console.error('❌ Header not found!');
            const bodyText = await page.innerText('body');
            console.log(`📄 Page Text Content (first 500 chars):\n${bodyText.substring(0, 500)}...`);
            throw e;
        }

        // 3. Verify Agent Cards
        console.log('👀 Counting Agents...');
        const agents = [
            'The Architect',
            'The Novice',
            'The Power User',
            'The Hacker',
            'The Scout'
        ];

        for (const agentName of agents) {
            const isVisible = await page.isVisible(`text=${agentName}`);
            if (isVisible) {
                console.log(`✅ Found Agent: ${agentName}`);
            } else {
                console.error(`❌ Missing Agent: ${agentName}`);
            }
        }

        console.log('\n✨ UI Verification Completed.');

    } catch (error) {
        console.error('\n⚠️  Verification Failed:', error.message);
    } finally {
        await browser.close();
    }
}

verifyAgentHub();
