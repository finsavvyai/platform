import { TestPlan, TestScenario } from '../workers/ai-review/types';

export interface LocalizedReport {
    id: string;
    language: string; // 'en', 'es', 'he', 'jp', etc.
    title: string;
    summary: string;
    sections: {
        heading: string;
        content: string;
        screenshotUrl?: string; // Visual evidence
    }[];
    generatedAt: Date;
}

/**
 * Polyglot Reporter (The Storyteller)
 * "The Voice" of Qestro.
 * Translates technical test results into human-readable, localized documentation.
 */
export class PolyglotReporter {
    private static instance: PolyglotReporter;

    // Simulated translation dictionary for demo purposes
    private dictionary: Record<string, Record<string, string>> = {
        'es': {
            'Bug Report': 'Informe de Error',
            'User Manual': 'Manual de Usuario',
            'Steps to Reproduce': 'Pasos para Reproducir',
            'Expected Result': 'Resultado Esperado'
        },
        'he': {
            'Bug Report': 'דוח תקלות',
            'User Manual': 'מדריך למשתמש',
            'Steps to Reproduce': 'צעדים לשחזור',
            'Expected Result': 'תוצאה צפויה'
        }
    };

    private constructor() { }

    public static getInstance(): PolyglotReporter {
        if (!PolyglotReporter.instance) {
            PolyglotReporter.instance = new PolyglotReporter();
        }
        return PolyglotReporter.instance;
    }

    /**
     * Generates a comprehensive Bug Report in the target language.
     */
    public generateBugReport(scenario: TestScenario, error: string, screenshotUrl: string, language: string = 'en'): LocalizedReport {
        const t = (key: string) => this.translate(key, language);

        return {
            id: `rep_bug_${Date.now()}`,
            language,
            title: `${t('Bug Report')}: ${scenario.title}`,
            summary: `Automated detection of failure in feature: ${scenario.description}`,
            sections: [
                {
                    heading: t('Steps to Reproduce'),
                    content: scenario.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
                },
                {
                    heading: 'Error Details', // Technical terms often stay English or need specific API translation
                    content: error
                },
                {
                    heading: 'Visual Evidence',
                    content: 'See attached screenshot for UI state at time of failure.',
                    screenshotUrl: screenshotUrl
                }
            ],
            generatedAt: new Date()
        };
    }

    /**
     * Auto-generates a User Manual based on a successful test plan.
     * "If the test passed, the steps represent the correct way to use the app."
     */
    public generateUserManual(plan: TestPlan, language: string = 'en'): LocalizedReport {
        const t = (key: string) => this.translate(key, language);

        return {
            id: `man_${Date.now()}`,
            language,
            title: `${t('User Manual')}: ${plan.ticketId}`, // In real app, ticket title would be used
            summary: `Guide generated from automated verification of Ticket #${plan.ticketId}`,
            sections: plan.scenarios
                .filter(s => s.type === 'positive') // Only document happy paths
                .map(s => ({
                    heading: s.title,
                    content: s.steps.join('\n\n'), // Formatted as a guide
                    screenshotUrl: 'http://placeholder.img/success.png' // Would be actual capture
                })),
            generatedAt: new Date()
        };
    }

    private translate(key: string, lang: string): string {
        if (lang === 'en') return key;
        return this.dictionary[lang]?.[key] || key; // Fallback to English if missing
    }
}
