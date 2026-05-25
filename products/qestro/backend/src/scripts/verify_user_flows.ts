import { chromium, Browser, Page } from 'playwright';

async function verifyUserFlows() {
    console.log('🚀 Starting User Journey Verification...');
    console.log('------------------------------------------------');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1600, height: 900 }
    });
    const page = await context.newPage();
    const baseUrl = 'http://localhost:3000';

    try {
        // JOURNEY 1: The First Impression (Dashboard)
        console.log('\n🔍 Journey 1: First Impression & Dashboard Interaction');
        await page.goto(baseUrl);
        await page.waitForTimeout(1000); // Wait for load

        // Check for Onboarding Guide
        try {
            const onboardingTitle = await page.textContent('h3:has-text("Get Started with Qestro")');
            if (onboardingTitle) console.log('   ✅ Onboarding Guide is visible');
        } catch (e) {
            console.log('   ❌ Onboarding Guide missing');
        }

        // Interact with Dashboard
        const diagnosticsBtn = await page.$('text=Run Diagnostics');
        if (diagnosticsBtn) {
            await diagnosticsBtn.click();
            console.log('   ✅ Clicked "Run Diagnostics"');
        } else {
            console.log('   ❌ "Run Diagnostics" button not found');
        }

        // JOURNEY 2: Mission Control (The "Wow" Factor)
        console.log('\n🔍 Journey 2: Mission Control (Ticket Ingestion)');
        await page.goto(`${baseUrl}/mission-control`);
        await page.waitForTimeout(1500);

        // Find the input and type a ticket
        try {
            // Looking for textarea (based on previous code reading, it might be a textarea)
            await page.fill('textarea', 'Feature: Login Page\nScenario: User logs in with valid credentials via Google SSO.');
            console.log('   ✅ Typed ticket requirements');

            // Click Process Button
            const processBtn = await page.$('button:has-text("Initialize Mission")'); // Updated selector
            if (processBtn) {
                await processBtn.click();
                console.log('   ✅ Clicked "Initialize Mission"');
                await page.waitForTimeout(2000); // Wait for mock logs

                // Check for generic log activity (Feed should update)
                const logs = await page.content();
                if (logs.includes('ARCHITECT') || logs.includes('Analyzing')) {
                    console.log('   ✅ Live Feed updated with Architecture logs');
                } else {
                    console.log('   ⚠️ Live Feed did not show expected logs');
                }
            } else {
                console.log('   ❌ "Process Ticket" button not found');
            }
        } catch (e) {
            console.log(`   ❌ Failed Mission Control flow: ${e.message}`);
        }

        // JOURNEY 3: API Studio (The Utility)
        console.log('\n🔍 Journey 3: API Studio (Request Execution)');
        await page.goto(`${baseUrl}/studio`);
        await page.waitForTimeout(1500);

        try {
            // Wait for mock collection to load
            await page.waitForSelector('text=Qestro API', { timeout: 3000 });
            console.log('   ✅ Collections loaded');

            // Click a request (Assuming first request in list)
            await page.click('text=Get Projects');
            console.log('   ✅ Selected "Get Projects" request');
            await page.waitForTimeout(500);

            // Click Send
            const sendBtn = await page.$('button:has-text("Send")');
            if (sendBtn) {
                await sendBtn.click();
                console.log('   ✅ Clicked "Send"');
                await page.waitForTimeout(1000);

                // Check for 200 OK
                const status = await page.textContent('text=200 OK');
                if (status) {
                    console.log('   ✅ Received "200 OK" response');
                } else {
                    console.log('   ❌ Did not see "200 OK" response');
                }
            }
        } catch (e) {
            console.log(`   ❌ Failed API Studio flow: ${e.message}`);
        }

        // JOURNEY 4: Agent Hub (The Team)
        console.log('\n🔍 Journey 4: Agent Department Interaction');
        await page.goto(`${baseUrl}/agents`);
        await page.waitForTimeout(1500);

        try {
            const architect = await page.isVisible('text=The Architect');
            if (architect) {
                console.log('   ✅ "The Architect" is present');
                // Try to hover or click if interactive
            } else {
                console.log('   ❌ "The Architect" not found');
            }
        } catch (e) {
            console.log(`   ❌ Hub check failed: ${e.message}`);
        }

    } catch (err) {
        console.error('Fatal Test Error:', err);
    } finally {
        console.log('\n------------------------------------------------');
        console.log('🏁 User Journey Verification Complete');
        await browser.close();
    }
}

verifyUserFlows();
