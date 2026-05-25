import { Ticket, TestPlan, TestScenario } from '../workers/ai-review/types.js';
import { QestroAIService } from './QestroAIService.js';
import OpenAI from 'openai';

/**
 * QA Architect Service
 * Acts as the AI Project Manager for Quality Assurance.
 * Reads requirements and generates comprehensive test strategies using AI.
 */
export class QA_Architect {
    private static instance: QA_Architect;
    private aiService: QestroAIService;
    private openai: OpenAI | null = null;

    // Simulated DB for now
    private plans: Map<string, TestPlan> = new Map();

    private constructor() {
        this.aiService = QestroAIService.getInstance();
        const apiKey = process.env.OPENAI_API_KEY ||
            process.env.QESTRO_AI_API_KEY ||
            process.env.OPENHANDS_API_KEY;
        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    public static getInstance(): QA_Architect {
        if (!QA_Architect.instance) {
            QA_Architect.instance = new QA_Architect();
        }
        return QA_Architect.instance;
    }

    /**
     * Ingests a new ticket (requirement) and generates a Test Plan.
     */
    public async analyzeTicket(ticket: Ticket): Promise<TestPlan> {
        console.log(`[QA Architect] Analyzing ticket: ${ticket.title}`);

        const scenarios = await this.generateScenariosFromAI(ticket);

        const plan: TestPlan = {
            id: `plan_${Date.now()}`,
            ticketId: ticket.id,
            scenarios: scenarios,
            createdAt: new Date(),
            status: 'draft',
            aiAnalysis: `Generated ${scenarios.length} scenarios based on AI requirement analysis.`
        };

        this.plans.set(plan.id, plan);
        console.log(`[QA Architect] Plan generated: ${plan.id} with ${scenarios.length} scenarios.`);

        return plan;
    }

    /**
     * Harvests tests from an existing URL (The Scout)
     */
    public async harvestTests(url: string): Promise<TestPlan> {
        console.log(`[QA Architect] Scouting URL for tests: ${url}`);

        if (this.openai) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: process.env.QESTRO_AI_MODEL || process.env.OPENHANDS_MODEL || 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `You are the Scout agent in Qestro, the leading AI QA platform.
Given a URL, predict the key user flows and generate test scenarios.
Return a JSON array of objects with: id, title, description, type (positive|negative|edge_case|security|performance), steps (string array), persona (novice|power_user|hacker|standard).
Return ONLY valid JSON, no markdown.`
                        },
                        {
                            role: 'user',
                            content: `Analyze this application URL and generate test scenarios: ${url}`
                        }
                    ],
                    temperature: 0.5,
                    max_tokens: 2000
                });

                const content = completion.choices[0]?.message?.content || '[]';
                const parsed = JSON.parse(content);
                const scenarios: TestScenario[] = Array.isArray(parsed) ? parsed : [];

                return {
                    id: `plan_harvest_${Date.now()}`,
                    ticketId: 'harvest_mission',
                    scenarios,
                    createdAt: new Date(),
                    status: 'active',
                    aiAnalysis: `AI-powered exploration of ${url}. Found ${scenarios.length} test scenarios.`
                };
            } catch (error) {
                console.error('[QA Architect] AI harvest failed, using fallback:', error);
            }
        }

        // Fallback static scenarios
        return {
            id: `plan_harvest_${Date.now()}`,
            ticketId: 'harvest_mission',
            scenarios: [
                {
                    id: 'sc_harvest_1',
                    title: 'Detected Login Flow',
                    description: 'User enters credentials and clicks login',
                    type: 'positive',
                    steps: ['Navigate to /login', 'Input email', 'Input password', 'Click Submit', 'Verify Dashboard'],
                    persona: 'standard'
                },
                {
                    id: 'sc_harvest_2',
                    title: 'Detected Form Validation',
                    description: 'Empty submission triggers error',
                    type: 'negative',
                    steps: ['Navigate to /login', 'Click Submit', 'Verify "Email required" error'],
                    persona: 'novice'
                }
            ],
            createdAt: new Date(),
            status: 'active',
            aiAnalysis: 'Template-based exploration (AI unavailable).'
        };
    }

    private async generateScenariosFromAI(ticket: Ticket): Promise<TestScenario[]> {
        if (this.openai) {
            try {
                const completion = await this.openai.chat.completions.create({
                    model: process.env.QESTRO_AI_MODEL || process.env.OPENHANDS_MODEL || 'gpt-4o',
                    messages: [
                        {
                            role: 'system',
                            content: `You are the QA Architect agent in Qestro, the leading AI QA platform.
Analyze the following ticket/requirement and generate comprehensive test scenarios.
Cover: happy path, negative flows, edge cases, security, and performance where relevant.
Return a JSON array of objects with: id (string), title (string), description (string), type (positive|negative|edge_case|security|performance), steps (string array), persona (novice|power_user|hacker|standard).
Return ONLY valid JSON, no markdown fences.`
                        },
                        {
                            role: 'user',
                            content: `Ticket: ${ticket.title}\nDescription: ${ticket.description}\nPriority: ${ticket.priority}\nSource: ${ticket.source}`
                        }
                    ],
                    temperature: 0.4,
                    max_tokens: 2000
                });

                const content = completion.choices[0]?.message?.content || '[]';
                const parsed = JSON.parse(content);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (error) {
                console.error('[QA Architect] AI scenario generation failed, using heuristics:', error);
            }
        }

        // Heuristic fallback
        return this.generateHeuristicScenarios(ticket);
    }

    private generateHeuristicScenarios(ticket: Ticket): TestScenario[] {
        const scenarios: TestScenario[] = [];

        scenarios.push({
            id: `sc_${Date.now()}_1`,
            title: `Verify ${ticket.title} (Happy Path)`,
            description: `Standard user successfully completes: ${ticket.title}`,
            type: 'positive',
            steps: ['Step 1: Open Feature', 'Step 2: Perform Action', 'Step 3: Verify Success'],
            persona: 'standard'
        });

        if (ticket.description.toLowerCase().includes('login') || ticket.title.toLowerCase().includes('auth')) {
            scenarios.push({
                id: `sc_${Date.now()}_2`,
                title: 'Invalid Credentials',
                description: 'User enters wrong password',
                type: 'negative',
                steps: ['Enter valid email', 'Enter invalid password', 'Verify error message'],
                persona: 'novice'
            });
            scenarios.push({
                id: `sc_${Date.now()}_3`,
                title: 'SQL Injection Attempt',
                description: 'Attempt injection in username field',
                type: 'security',
                steps: ["Enter ' OR 1=1 -- in email", 'Verify rejection'],
                persona: 'hacker'
            });
        }

        if (ticket.priority === 'critical') {
            scenarios.push({
                id: `sc_${Date.now()}_4`,
                title: 'Load Testing',
                description: 'Verify feature under high load',
                type: 'performance',
                steps: ['Simulate 100 concurrent users performing action'],
                persona: 'power_user'
            });
        }

        return scenarios;
    }

    public getPlan(planId: string): TestPlan | undefined {
        return this.plans.get(planId);
    }
}
