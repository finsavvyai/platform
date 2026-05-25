import { chromium } from 'playwright';

async function verifyPersistentOnboarding() {
    console.log('🚀 Verifying Persistent Onboarding...');

    // Launch persistent context to simulate "same browser"
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    const baseUrl = 'http://localhost:3000';

    try {
        console.log('1. Navigating to Dashboard...');
        await page.goto(baseUrl);
        await page.waitForTimeout(2000);

        // Manually trigger a "completion" by executing script in browser context
        // Since we didn't add click handlers yet, we will simulate the localStorage update directly 
        // to prove the READ functionality works on reload.

        console.log('2. Simulating Task Completion (Writing to localStorage)...');
        await page.evaluate(() => {
            const tasks = [
                { id: '1', title: 'Create a Test Case', completed: true, hasTutorial: true }, // Marked TRUE
                { id: '2', title: 'Create a Run', completed: false, hasTutorial: true },
                // ... others defaults
            ];
            localStorage.setItem('qestro_onboarding_tasks', JSON.stringify(tasks));
        });

        console.log('3. Reloading Page...');
        await page.reload();
        await page.waitForTimeout(2000);

        console.log('4. Checking UI state...');
        // Locate the first task's checkmark container.
        // Based on code: completed = "bg-emerald-500"

        // We look for the specific task text "Create a Test Case"
        // Then find its parent container
        const taskText = page.locator('text=Create a Test Case');
        const taskContainer = taskText.locator('..');

        // Actually, let's just check for the presence of the strikethrough class 'line-through'
        // or the specific color class on the icon container

        const isCompleted = await taskText.evaluate((el) => {
            return el.classList.contains('line-through'); // The code uses "text-gray-400 line-through" for completed
        });

        if (isCompleted) {
            console.log('   ✅ Task "Create a Test Case" is visually marked as completed after reload.');
        } else {
            console.log('   ❌ Task "Create a Test Case" is NOT marked completed. Persistence failed.');
            const classList = await taskText.getAttribute('class');
            console.log('      Class list:', classList);
        }

        console.log('5. Verifying "Run Diagnostics" Animation...');
        const diagnosticsBtn = await page.locator('text=Run Diagnostics');

        if (await diagnosticsBtn.isVisible()) {
            await diagnosticsBtn.click();
            console.log('   ✅ Clicked "Run Diagnostics"');

            // Check for state change to "Running Scan..."
            // We use a small wait to allow React to rerender
            await page.waitForTimeout(200);

            const btnText = await diagnosticsBtn.textContent();
            console.log(`   ℹ️ Button text is now: "${btnText}"`);

            if (btnText?.includes('Running Scan')) {
                console.log('   ✅ Button successfully transitioned to loading state');
            } else {
                console.log('   ❌ Button DID NOT transition to loading state');
            }

            // Wait for scan to complete (3s timeout in code)
            await page.waitForTimeout(3500);
            const finalText = await diagnosticsBtn.textContent();
            if (finalText?.includes('Run Diagnostics')) {
                console.log('   ✅ Button returned to idle state');
            } else {
                console.log('   ❌ Button stuck in loading state');
            }

        } else {
            console.log('   ❌ "Run Diagnostics" button not found');
        }


    } catch (err) {
        console.error('Test Error:', err);
    } finally {
        await browser.close();
    }
}

verifyPersistentOnboarding();
