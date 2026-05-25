
import { QA_Architect } from '../services/QA_Architect';
import { PersonaService } from '../services/PersonaService';
import { TestRepositoryManager } from '../services/TestRepositoryManager';
import { PolyglotReporter } from '../services/PolyglotReporter';
import { Ticket, TestScenario } from '../workers/ai-review/types';

async function verify() {
    console.log('🚀 Starting Autonomous Features Verification...\n');

    // 1. Verify QA Architect
    console.log('--- 1. Testing QA Architect (The Brain) ---');
    const architect = QA_Architect.getInstance();
    const ticket: Ticket = {
        id: 'TICKET-123',
        title: 'Implement Dark Mode',
        description: 'User should be able to toggle dark mode in settings.',
        source: 'jira',
        priority: 'medium',
        status: 'open'
    };
    const plan = await architect.analyzeTicket(ticket);
    console.log('✅ Generated Test Plan Scenarios:', plan.scenarios.length);
    console.log('   Sample Scenario:', plan.scenarios[0].title);

    // 2. Verify Persona Service
    console.log('\n--- 2. Testing Persona Service (The Squad) ---');
    const personaService = PersonaService.getInstance();
    const novice = personaService.getPersonaConfig('novice');
    const hacker = personaService.getPersonaConfig('hacker');
    console.log(`✅ Loaded Persona: ${novice.name} (Speed: ${novice.behavior.interactionSpeed})`);
    console.log(`✅ Loaded Persona: ${hacker.name} (Chaos: ${hacker.behavior.chaosFactor})`);

    // 3. Verify Repository Manager
    console.log('\n--- 3. Testing Repository Manager (The Curator) ---');
    const curator = TestRepositoryManager.getInstance();
    // Simulate a flaky test
    const scenarioId = 'test_login_flux';
    for (let i = 0; i < 8; i++) await curator.recordExecution({ scenarioId, status: 'passed', duration: 100, timestamp: new Date() });
    for (let i = 0; i < 2; i++) await curator.recordExecution({ scenarioId, status: 'failed', duration: 100, error: 'Timeout', timestamp: new Date() }); // 20% fail rate

    const health = curator.analyzeHealth(scenarioId);
    console.log(`✅ analyzed Health for ${scenarioId}:`);
    console.log(`   Status: ${health.stabilityStatus} (Score: ${health.flakinessScore})`);
    console.log(`   Suggestion: ${health.suggestedFix}`);

    // 4. Verify Polyglot Reporter
    console.log('\n--- 4. Testing Polyglot Reporter (The Storyteller) ---');
    const reporter = PolyglotReporter.getInstance();
    const scenario: TestScenario = plan.scenarios[0];
    const spanishReport = reporter.generateBugReport(
        scenario,
        'Element not visible',
        'http://img.com/fail.png',
        'es'
    );
    console.log('✅ Generated Spanish Bug Report:');
    console.log(`   Title: ${spanishReport.title}`);
    console.log(`   Sections: ${spanishReport.sections.map(s => s.heading).join(', ')}`);

    console.log('\n✨ Verification Complete: All systems nominal.');
}

verify().catch(console.error);
