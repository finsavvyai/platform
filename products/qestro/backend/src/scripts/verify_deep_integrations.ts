import { chromium } from 'playwright';

async function verifyDeepIntegrations() {
    console.log('🚀 Verifying Deep Integrations (Settings & Modals)...');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    const baseUrl = 'http://localhost:3000';

    // Listen for browser console logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    try {
        await page.goto(`${baseUrl}/integrations`);
        await page.waitForTimeout(1000);

        console.log('1. Testing Deep Slack Integration (Webhook Flow)...');
        const slackCard = page.locator('.group', { hasText: 'Slack' }).first();
        const connectSlackBtn = slackCard.locator('button', { hasText: 'Connect Webhook' });

        // Ensure disconnected first
        if (await slackCard.locator('text=Active').isVisible()) {
            console.log('   ℹ️ Slack already active. Disconnecting first...');
            page.on('dialog', dialog => dialog.accept());
            await slackCard.locator('button', { hasText: 'Manage' }).click();
            await page.waitForTimeout(1000);
        }

        if (await connectSlackBtn.isVisible()) {
            await connectSlackBtn.click();
            console.log('   ℹ️ Clicked Connect. Checking for Modal...');
            await page.waitForTimeout(1000); // Increased wait

            const modal = page.locator('h2', { hasText: 'Configure Slack' });
            if (await modal.isVisible()) {
                console.log('   ✅ Modal opened successfully.');

                // Fill Form
                await page.fill('input[placeholder="https://hooks.slack.com/services/..."]', 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX');

                await page.click('button:has-text("Save & Connect")');

                // Check if Backend Verification was attempted (log will appear even if it fails due to fake URL)
                // We monitor console logs for "Slack Verification"

                await page.waitForTimeout(2000); // Wait for backend call

                if (await slackCard.locator('text=Active').isVisible()) {
                    console.log('   ✅ Slack Connected via Modal!');
                } else {
                    console.error('   ❌ Slack Status is not Active.');
                    process.exit(1);
                }
            } else {
                console.error('   ❌ Modal did not appear.');
                // Debug: screenshot or list visible text
                console.log('   Visible H2s:', await page.locator('h2').allInnerTexts());
            }
        } else {
            console.error('   ❌ "Connect Webhook" button not found.');
            // Debug: Print HTML to see what's actually there
            console.log('   Slack Card HTML:', await slackCard.innerHTML());
            // Debug: check what buttons are there
            console.log('   Buttons in Slack card:', await slackCard.locator('button').allInnerTexts());
        }

        console.log('2. Testing Deep VS Code Integration (Key Gen Flow)...');
        const vsCodeCard = page.locator('.group', { hasText: 'VS Code' }).first();
        const genKeyBtn = vsCodeCard.locator('button', { hasText: 'Generate Key' });

        // Ensure disconnected
        if (await vsCodeCard.locator('text=Active').isVisible()) {
            console.log('   ℹ️ VS Code already active. Disconnecting...');
            page.on('dialog', dialog => dialog.accept());
            await vsCodeCard.locator('button', { hasText: 'Manage' }).click();
            await page.waitForTimeout(1000);
        }

        if (await genKeyBtn.isVisible()) {
            await genKeyBtn.click();
            console.log('   ℹ️ Clicked Generate Key. Checking for Modal...');
            await page.waitForTimeout(1000);

            const modal = page.locator('h2', { hasText: 'Configure VS Code' });
            if (await modal.isVisible()) {
                console.log('   ✅ Modal opened.');

                await page.click('button:has-text("Generate New Key")');
                await page.waitForTimeout(1000);

                const keyDisplay = page.locator('div.font-mono').filter({ hasText: 'qestro_wk_' });
                await keyDisplay.waitFor({ state: 'visible', timeout: 5000 });
                const keyText = await keyDisplay.textContent();

                if (keyText?.includes('qestro_wk_')) {
                    console.log(`   ✅ API Key Generated: ${keyText.substring(0, 15)}...`);

                    await page.click('button:has-text("Done")');
                    await page.waitForTimeout(1500); // 1.5s sleep buffer

                    if (await vsCodeCard.locator('text=Active').isVisible()) {
                        console.log('   ✅ VS Code Connected via Key Gen!');
                    } else {
                        console.error('   ❌ VS Code status did not update.');
                    }

                } else {
                    console.error('   ❌ API Key format incorrect or not displayed.');
                }
            } else {
                console.error('   ❌ VS Code Modal did not appear.');
            }
        } else {
            console.error('   ❌ "Generate Key" button not found.');
            console.log('   Buttons in VS Code card:', await vsCodeCard.locator('button').allInnerTexts());
        }

        // 3. Test Linear Integration (Generic API Key Flow)
        {
            await page.waitForTimeout(1000);
            console.log('\n3. Testing Linear Integration (Generic API Key Flow)...');
            const linearCard = page.locator('div').filter({ hasText: 'Linear' }).last();
            const connectBtn = linearCard.locator('button', { hasText: 'Connect Linear' });

            if (await connectBtn.isVisible()) {
                await connectBtn.click();
                await page.waitForTimeout(1000);

                if (await page.locator('h2', { hasText: 'Configure Linear' }).isVisible()) {
                    console.log('   ✅ Modal opened.');
                    await page.fill('input[placeholder="lin_api_..."]', 'lin_api_test_12345');

                    // Click the last "Connect" button which should be in the modal
                    await page.locator('button').filter({ hasText: 'Connect' }).last().click({ force: true });
                    await page.waitForTimeout(2000);

                    if (await linearCard.locator('text=Active').isVisible()) {
                        console.log('   ✅ Linear Connected!');
                    }
                }
            } else {
                console.log('   ℹ️ Linear button not found (might be scrolled out or name mismatch).');
            }
        }

        // 4. Test Jira Integration (Complex Form)
        {
            console.log('\n4. Testing Jira Integration (Complex Form)...');
            const jiraCard = page.locator('div').filter({ hasText: 'Jira' }).last();
            const connectBtn = jiraCard.locator('button', { hasText: 'Connect Jira' });

            if (await connectBtn.isVisible()) {
                await connectBtn.click({ force: true });
                await page.waitForTimeout(1000);

                if (await page.locator('h2', { hasText: 'Configure Jira' }).isVisible()) {
                    console.log('   ✅ Modal opened.');
                    await page.fill('input[placeholder="company.atlassian.net"]', 'mycompany.atlassian.net');
                    await page.fill('input[placeholder="you@company.com"]', 'qa@qestro.io');
                    await page.fill('input[placeholder="Atlassian API Token"]', 'AT-123456789');

                    await page.click('button:has-text("Connect Jira")', { force: true });
                    await page.waitForTimeout(2000);

                    if (await jiraCard.locator('text=Active').isVisible()) {
                        console.log('   ✅ Jira Connected!');
                    }
                }
            }
        }

        // 5. Test Notion Integration (Mock OAuth)
        {
            console.log('\n5. Testing Notion Integration (OAuth Simulation)...');
            const notionCard = page.locator('div').filter({ hasText: 'Notion' }).last();
            const connectBtn = notionCard.locator('button', { hasText: 'Link Workspace' });

            if (await connectBtn.isVisible()) {
                await connectBtn.click({ force: true });
                await page.waitForTimeout(1000);

                if (await page.locator('h2', { hasText: 'Configure Notion' }).isVisible()) {
                    console.log('   ✅ Modal opened.');
                    await page.click('button:has-text("Authorize with Notion")', { force: true });

                    // Check for connecting state
                    try {
                        await page.waitForSelector('button:has-text("Connecting to Notion...")', { timeout: 1000 });
                        console.log('   ✅ Loading state verified.');
                    } catch (e) { }

                    await page.waitForTimeout(2500);

                    if (await notionCard.locator('text=Active').isVisible()) {
                        console.log('   ✅ Notion Connected!');
                    }
                }
            }
        }

    } catch (err) {
        console.error('Test Error:', err);
    } finally {
        await browser.close();
    }
}

verifyDeepIntegrations();
