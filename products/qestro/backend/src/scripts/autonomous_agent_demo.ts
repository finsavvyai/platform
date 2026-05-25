
import { chromium } from 'playwright';
import { PersonaService } from '../services/PersonaService';

async function runAutonomousDemo() {
    console.log('🤖 Starting Autonomous Agent Demo...');

    // 1. Initialize The Squad
    const personaService = PersonaService.getInstance();

    // Let's simulate "The Novice" - Slow and prone to getting lost
    const personaId = 'novice';
    const persona = personaService.getPersonaConfig(personaId);

    console.log(`\n👤 ACTIVATE PERSONA: ${persona.name.toUpperCase()}`);
    console.log(`   "${persona.description}"`);
    console.log(`   Speed: ${persona.behavior.interactionSpeed}`);
    console.log(`   Confusion Threshold: ${persona.behavior.confusionThreshold}`);

    // Map abstract speed to milliseconds
    const speedMap: Record<string, number> = {
        'slow': 2000,
        'medium': 1000,
        'fast': 300,
        'blazing': 50
    };
    const delay = speedMap[persona.behavior.interactionSpeed] || 1000;

    // 2. Launch Browser (The Eyes)
    console.log('\n👁️  Launching Vision System (Playwright)...');
    const browser = await chromium.launch({ headless: false }); // Headless false so user can see it if they run it
    const context = await browser.newContext();
    const page = await context.newPage();

    // 3. Execute Mission
    try {
        console.log(`\n🚀 [${persona.name}] Navigating to target...`);
        await page.goto('https://example.com');
        await page.waitForTimeout(delay);

        // Simulate reading the page
        console.log(`👀 [${persona.name}] Scanning page content...`);
        const title = await page.title();
        console.log(`   Found Title: "${title}"`);
        await page.waitForTimeout(delay);

        // Demonstrate Behavior: "Confusion" check
        if (Math.random() < persona.behavior.confusionThreshold) {
            console.log(`🤔 [${persona.name}] I am confused. Pausing to look for help...`);
            await page.waitForTimeout(3000); // Extra hesitation
            // Novice might hover over random things
            console.log(`🖱️ [${persona.name}] Hovering uncertainly...`);
            await page.hover('h1');
        }

        // Demonstrate Action
        console.log(`👉 [${persona.name}] clear action: Clicking 'More Information'...`);
        // Note: checking if selector exists to avoid crash in demo
        if (await page.isVisible('a')) {
            await page.click('a');
        } else {
            console.log(`⚠️ [${persona.name}] Could not find link. Giving up.`);
        }

        await page.waitForTimeout(delay);
        console.log(`✅ [${persona.name}] Navigation successful.`);

    } catch (error) {
        console.error(`💥 [${persona.name}] Encountered system error:`, error);
    } finally {
        console.log('\n🛑 Mission Complete. Terminating Agent.');
        await browser.close();
    }
}

runAutonomousDemo().catch(console.error);
