import { TestScenario } from '../workers/ai-review/types';

export interface PersonaProfile {
    id: 'novice' | 'standard' | 'power_user' | 'hacker';
    name: string;
    description: string;
    behavior: {
        interactionSpeed: 'slow' | 'medium' | 'fast' | 'blazing'; // milliseconds delay between actions
        errorTolerance: 'low' | 'medium' | 'high'; // low = reports everything, high = ignores minor UI glitches
        confusionThreshold: number; // 0-1, likelihood to click "Help" or get stuck on complex UI
        chaosFactor: number; // 0-1, likelihood to do random actions (monkey testing)
        exploreDepth: 'shallow' | 'normal' | 'deep'; // DFS depth for crawling
    };
    focusAreas: ('usability' | 'functionality' | 'performance' | 'security' | 'accessibility')[];
}

/**
 * Persona Service (The Squad)
 * Manages the "Personalities" of the AI Agents.
 * Configures the Qestro AI worker to simulate specific user types.
 */
export class PersonaService {
    private static instance: PersonaService;
    private profiles: Map<string, PersonaProfile> = new Map();

    private constructor() {
        this.initializeProfiles();
    }

    public static getInstance(): PersonaService {
        if (!PersonaService.instance) {
            PersonaService.instance = new PersonaService();
        }
        return PersonaService.instance;
    }

    private initializeProfiles() {
        // 1. The Novice: Simulates a non-technical, easily confused user (Grandma test)
        this.profiles.set('novice', {
            id: 'novice',
            name: 'The Novice',
            description: 'Slow, deliberate, easily confused. Checks for usability and clarity.',
            behavior: {
                interactionSpeed: 'slow', // 2000ms delay
                errorTolerance: 'low', // Complains about everything
                confusionThreshold: 0.8, // High chance to stop if UI is unclear
                chaosFactor: 0.1,
                exploreDepth: 'shallow'
            },
            focusAreas: ['usability', 'accessibility']
        });

        // 2. The Standard User: The happy path walker
        this.profiles.set('standard', {
            id: 'standard',
            name: 'Standard User',
            description: 'Average user. Follows workflows but may make occasional mistakes.',
            behavior: {
                interactionSpeed: 'medium', // 800ms delay
                errorTolerance: 'medium',
                confusionThreshold: 0.3,
                chaosFactor: 0.0,
                exploreDepth: 'normal'
            },
            focusAreas: ['functionality']
        });

        // 3. The Power User: Speed demon, expecting high performance
        this.profiles.set('power_user', {
            id: 'power_user',
            name: 'The Power User',
            description: 'Fast, efficient, high expectations. Stresses performance.',
            behavior: {
                interactionSpeed: 'blazing', // 50ms delay
                errorTolerance: 'high', // Doesn't care about typos, cares about speed
                confusionThreshold: 0.05,
                chaosFactor: 0.1,
                exploreDepth: 'normal'
            },
            focusAreas: ['performance', 'functionality']
        });

        // 4. The Hacker: Security researcher trying to break things
        this.profiles.set('hacker', {
            id: 'hacker',
            name: 'The Hacker',
            description: 'Malicious actor. Tries injections, edge cases, and unauthorized access.',
            behavior: {
                interactionSpeed: 'fast',
                errorTolerance: 'low',
                confusionThreshold: 0.0,
                chaosFactor: 0.8, // High chaos
                exploreDepth: 'deep' // Crawls everywhere looking for holes
            },
            focusAreas: ['security', 'usability'] // Usability included to find hidden inputs
        });
    }

    /**
     * getPersonaConfig
     * Returns the configuration to inject into the Qestro AI agent
     */
    public getPersonaConfig(personaId: string): PersonaProfile {
        const profile = this.profiles.get(personaId) || this.profiles.get('standard')!;
        console.log(`[Persona Service] Loading profile: ${profile.name}`);
        return profile;
    }

    /**
     * enrichScenario
     * Decorates a Test Scenario with persona-specific instructions
     */
    public enrichScenarioWithPersona(scenario: TestScenario): string {
        const profile = this.getPersonaConfig(scenario.persona);

        // This prompts the LLM agent to adopt the mindset
        return `
        YOU ARE NOW SIMULATING: ${profile.name.toUpperCase()}
        DESCRIPTION: ${profile.description}
        
        OPERATIONAL DIRECTIVES:
        - SPEED: ${profile.behavior.interactionSpeed}
        - CHAOS: ${profile.behavior.chaosFactor * 100}% chance of random deviation
        - FOCUS: Prioritize ${profile.focusAreas.join(' and ')} issues.
        
        MISSION: Execute the following scenario while embodying this persona.
        LOG specific complaints if the UI confuses you (Confusion Threshold: ${profile.behavior.confusionThreshold}).
        `;
    }
}
