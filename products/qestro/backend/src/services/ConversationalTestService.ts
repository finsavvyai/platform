/**
 * ConversationalTestService — NL Conversations → Test Suites via OpenClaw (P2)
 * 
 * Enables multi-turn conversational test generation through messaging apps.
 * Users describe test scenarios in natural language, the service orchestrates
 * a structured dialogue to refine requirements, then generates full test suites.
 * 
 * Flow:
 *   1. User: "I need tests for our payment API"
 *   2. Agent: clarifying questions (methods, scenarios, environments)
 *   3. User: answers
 *   4. Agent: generates tests via Qestro AI engine
 *   5. User: approves / requests modifications
 *   6. Tests saved to Qestro library
 * 
 * @see docs/research/OPENCLAW_INTEGRATION.md (Strategy #5)
 */

import { OpenClawBridgeService, type OpenClawChannel } from './OpenClawBridgeService.js';

// ─── Types ─────────────────────────────────────────────────────────────

export type ConversationPhase =
    | 'intake'          // Initial user request
    | 'clarification'   // Asking follow-up questions
    | 'generation'      // Generating test cases
    | 'review'          // User reviewing generated tests
    | 'modification'    // User requesting changes
    | 'finalized'       // Tests approved and saved
    | 'cancelled';      // User cancelled

export interface ConversationMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
    metadata?: Record<string, any>;
}

export interface TestScenario {
    id: string;
    name: string;
    description: string;
    type: 'happy_path' | 'validation' | 'edge_case' | 'negative' | 'performance' | 'security';
    priority: 'critical' | 'high' | 'medium' | 'low';
    steps: Array<{
        action: string;
        expected: string;
        data?: Record<string, any>;
    }>;
    generatedCode?: string;
    approved: boolean;
}

export interface ConversationContext {
    domain?: string;          // e.g. "payment", "auth", "checkout"
    platform?: string;        // web, mobile, api
    framework?: string;       // playwright, cypress
    environment?: string;     // staging, production
    methods?: string[];       // e.g. ["card", "bank"] for payments
    scenarioTypes?: string[]; // happy_path, validation, edge_cases
    additionalContext?: string;
    targetUrl?: string;
    apiEndpoints?: string[];
}

export interface ConversationSession {
    id: string;
    phase: ConversationPhase;
    messages: ConversationMessage[];
    context: ConversationContext;
    scenarios: TestScenario[];
    createdAt: string;
    updatedAt: string;
    channel?: OpenClawChannel;
    notifyOnComplete: boolean;
}

export interface ClarificationQuestion {
    id: string;
    question: string;
    options?: string[];
    required: boolean;
    contextKey: keyof ConversationContext;
}

// ─── Clarification Templates ──────────────────────────────────────────

const CLARIFICATION_TEMPLATES: Record<string, ClarificationQuestion[]> = {
    payment: [
        {
            id: 'methods',
            question: 'Which payment methods should we cover?',
            options: ['Credit Card (Visa/MC)', 'Debit Card', 'Bank Transfer', 'Crypto', 'Mobile Wallets (Apple/Google Pay)', 'All'],
            required: true,
            contextKey: 'methods',
        },
        {
            id: 'scenarios',
            question: 'What test scenarios do you need?',
            options: ['Happy path only', 'Happy path + Validation', 'Full coverage (happy + validation + edge cases)', 'Security-focused'],
            required: true,
            contextKey: 'scenarioTypes',
        },
        {
            id: 'environment',
            question: 'Which environment should the tests target?',
            options: ['Staging', 'Production-like', 'Local development'],
            required: false,
            contextKey: 'environment',
        },
    ],
    auth: [
        {
            id: 'auth_methods',
            question: 'Which authentication methods?',
            options: ['Email/Password', 'OAuth (Google/GitHub)', 'SSO/SAML', '2FA/MFA', 'Magic Links', 'All'],
            required: true,
            contextKey: 'methods',
        },
        {
            id: 'scenarios',
            question: 'What should we test?',
            options: ['Login/Logout flows', 'Registration', 'Password recovery', 'Session management', 'Security (brute force, injection)', 'Full coverage'],
            required: true,
            contextKey: 'scenarioTypes',
        },
    ],
    api: [
        {
            id: 'endpoints',
            question: 'Which API endpoints should we test?',
            options: ['All CRUD endpoints', 'Specific endpoints (list them)', 'Authentication endpoints', 'Public endpoints only'],
            required: true,
            contextKey: 'apiEndpoints',
        },
        {
            id: 'scenarios',
            question: 'What types of API tests?',
            options: ['Contract/Schema validation', 'Status codes & error handling', 'Performance/Load', 'Security (injection, auth bypass)', 'Full coverage'],
            required: true,
            contextKey: 'scenarioTypes',
        },
    ],
    checkout: [
        {
            id: 'flow_steps',
            question: 'Which checkout steps to cover?',
            options: ['Cart management', 'Address/shipping', 'Payment', 'Order confirmation', 'Full end-to-end'],
            required: true,
            contextKey: 'methods',
        },
        {
            id: 'scenarios',
            question: 'What scenarios?',
            options: ['Happy path', 'Coupon/discount codes', 'Stock validation', 'Edge cases (empty cart, max items)', 'Full coverage'],
            required: true,
            contextKey: 'scenarioTypes',
        },
    ],
    general: [
        {
            id: 'platform',
            question: 'What platform?',
            options: ['Web (browser)', 'Mobile (iOS/Android)', 'API/Backend', 'Cross-platform'],
            required: true,
            contextKey: 'platform',
        },
        {
            id: 'scenarios',
            question: 'What types of tests?',
            options: ['Happy path', 'Validation & error handling', 'Edge cases', 'Full coverage'],
            required: true,
            contextKey: 'scenarioTypes',
        },
    ],
};

// ─── Service ───────────────────────────────────────────────────────────

export class ConversationalTestService {
    private static instance: ConversationalTestService;
    private bridge: OpenClawBridgeService;
    private sessions: Map<string, ConversationSession> = new Map();
    private readonly MAX_SESSIONS = 100;

    private constructor() {
        this.bridge = OpenClawBridgeService.getInstance();
        console.log('💬 [ConversationalTest] Service initialized');
    }

    public static getInstance(): ConversationalTestService {
        if (!ConversationalTestService.instance) {
            ConversationalTestService.instance = new ConversationalTestService();
        }
        return ConversationalTestService.instance;
    }

    // ─── Session Lifecycle ────────────────────────────────────────────

    /**
     * Start a new conversational test generation session
     */
    public async startConversation(
        userMessage: string,
        options?: {
            channel?: OpenClawChannel;
            notifyOnComplete?: boolean;
        }
    ): Promise<{
        session: ConversationSession;
        response: string;
        questions?: ClarificationQuestion[];
    }> {
        const sessionId = this.generateSessionId();
        const domain = this.detectDomain(userMessage);

        const session: ConversationSession = {
            id: sessionId,
            phase: 'intake',
            messages: [
                {
                    role: 'user',
                    content: userMessage,
                    timestamp: new Date().toISOString(),
                },
            ],
            context: {
                domain,
                platform: this.detectPlatform(userMessage),
                framework: 'playwright', // default
            },
            scenarios: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            channel: options?.channel,
            notifyOnComplete: options?.notifyOnComplete ?? true,
        };

        this.sessions.set(sessionId, session);
        this.pruneOldSessions();

        // Get clarification questions for detected domain
        const questions = CLARIFICATION_TEMPLATES[domain] || CLARIFICATION_TEMPLATES.general;

        // Build response
        const response = this.buildClarificationResponse(session, questions);

        // Add assistant response to history
        session.messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            metadata: { phase: 'clarification', questions: questions.map(q => q.id) },
        });

        session.phase = 'clarification';
        session.updatedAt = new Date().toISOString();

        // Notify via OpenClaw if channel specified
        if (options?.channel) {
            await this.bridge.sendMessage(response, {
                name: 'Qestro-TestGen',
                channel: options.channel,
                thinking: 'medium',
            });
        }

        return { session, response, questions };
    }

    /**
     * Process a user's answer to clarification questions
     */
    public async answerQuestions(
        sessionId: string,
        answers: Record<string, string | string[]>
    ): Promise<{
        session: ConversationSession;
        response: string;
        scenarios: TestScenario[];
    }> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);
        if (session.phase !== 'clarification') {
            throw new Error(`Session is in '${session.phase}' phase, expected 'clarification'`);
        }

        // Record answers
        session.messages.push({
            role: 'user',
            content: JSON.stringify(answers),
            timestamp: new Date().toISOString(),
            metadata: { answers },
        });

        // Apply answers to context
        for (const [key, value] of Object.entries(answers)) {
            if (key === 'methods' || key === 'auth_methods' || key === 'flow_steps') {
                session.context.methods = Array.isArray(value) ? value : [value];
            } else if (key === 'scenarios') {
                session.context.scenarioTypes = Array.isArray(value) ? value : [value];
            } else if (key === 'environment') {
                session.context.environment = Array.isArray(value) ? value[0] : value;
            } else if (key === 'platform') {
                session.context.platform = Array.isArray(value) ? value[0] : value;
            } else if (key === 'endpoints') {
                session.context.apiEndpoints = Array.isArray(value) ? value : [value];
            } else if (key === 'additionalContext') {
                session.context.additionalContext = Array.isArray(value) ? value.join(', ') : value;
            }
        }

        // Generate test scenarios
        session.phase = 'generation';
        session.updatedAt = new Date().toISOString();

        const scenarios = this.generateScenarios(session);
        session.scenarios = scenarios;

        // Build review response
        const response = this.buildReviewResponse(session, scenarios);

        session.messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            metadata: { phase: 'review', scenarioCount: scenarios.length },
        });

        session.phase = 'review';
        session.updatedAt = new Date().toISOString();

        // Notify via OpenClaw
        if (session.channel) {
            await this.bridge.sendMessage(response, {
                name: 'Qestro-TestGen',
                channel: session.channel,
                thinking: 'low',
            });
        }

        return { session, response, scenarios };
    }

    /**
     * Approve generated scenarios and finalize
     */
    public async approveScenarios(
        sessionId: string,
        approvedIds?: string[], // If omitted, approve all
        modifications?: Record<string, Partial<TestScenario>>
    ): Promise<{
        session: ConversationSession;
        response: string;
        savedScenarios: TestScenario[];
    }> {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);
        if (session.phase !== 'review' && session.phase !== 'modification') {
            throw new Error(`Session is in '${session.phase}' phase, expected 'review' or 'modification'`);
        }

        // Apply modifications if any
        if (modifications) {
            for (const [id, mods] of Object.entries(modifications)) {
                const scenario = session.scenarios.find(s => s.id === id);
                if (scenario) {
                    Object.assign(scenario, mods);
                }
            }
        }

        // Mark approved scenarios
        const toApprove = approvedIds || session.scenarios.map(s => s.id);
        const savedScenarios: TestScenario[] = [];

        for (const scenario of session.scenarios) {
            if (toApprove.includes(scenario.id)) {
                scenario.approved = true;
                scenario.generatedCode = this.generatePlaywrightCode(scenario, session.context);
                savedScenarios.push(scenario);
            }
        }

        session.phase = 'finalized';
        session.updatedAt = new Date().toISOString();

        const response = this.buildFinalizedResponse(session, savedScenarios);

        session.messages.push({
            role: 'assistant',
            content: response,
            timestamp: new Date().toISOString(),
            metadata: { phase: 'finalized', approvedCount: savedScenarios.length },
        });

        // Notify via OpenClaw
        if (session.channel && session.notifyOnComplete) {
            await this.bridge.sendMessage(response, {
                name: 'Qestro-TestGen',
                channel: session.channel,
                thinking: 'low',
            });
        }

        return { session, response, savedScenarios };
    }

    /**
     * Cancel a conversation
     */
    public cancelConversation(sessionId: string): ConversationSession {
        const session = this.sessions.get(sessionId);
        if (!session) throw new Error(`Session ${sessionId} not found`);

        session.phase = 'cancelled';
        session.updatedAt = new Date().toISOString();
        session.messages.push({
            role: 'system',
            content: 'Conversation cancelled by user',
            timestamp: new Date().toISOString(),
        });

        return session;
    }

    // ─── Queries ──────────────────────────────────────────────────────

    public getSession(sessionId: string): ConversationSession | undefined {
        return this.sessions.get(sessionId);
    }

    public getActiveSessions(): ConversationSession[] {
        return Array.from(this.sessions.values())
            .filter(s => !['finalized', 'cancelled'].includes(s.phase));
    }

    public getAllSessions(): ConversationSession[] {
        return Array.from(this.sessions.values())
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    }

    public getStats(): {
        total: number;
        active: number;
        finalized: number;
        cancelled: number;
        totalScenariosGenerated: number;
        totalScenariosApproved: number;
    } {
        const sessions = Array.from(this.sessions.values());
        return {
            total: sessions.length,
            active: sessions.filter(s => !['finalized', 'cancelled'].includes(s.phase)).length,
            finalized: sessions.filter(s => s.phase === 'finalized').length,
            cancelled: sessions.filter(s => s.phase === 'cancelled').length,
            totalScenariosGenerated: sessions.reduce((sum, s) => sum + s.scenarios.length, 0),
            totalScenariosApproved: sessions.reduce(
                (sum, s) => sum + s.scenarios.filter(sc => sc.approved).length, 0
            ),
        };
    }

    // ─── Internal: Domain Detection ───────────────────────────────────

    private detectDomain(message: string): string {
        const lower = message.toLowerCase();
        const domainPatterns: Record<string, string[]> = {
            payment: ['payment', 'pay', 'checkout', 'card', 'billing', 'invoice', 'transaction', 'stripe', 'paypal'],
            auth: ['login', 'auth', 'sign in', 'signup', 'register', 'password', 'sso', 'oauth', '2fa', 'mfa', 'session'],
            checkout: ['cart', 'shopping', 'order', 'shipping', 'coupon', 'discount', 'purchase'],
            api: ['api', 'endpoint', 'rest', 'graphql', 'webhook', 'http', 'request', 'response'],
        };

        for (const [domain, patterns] of Object.entries(domainPatterns)) {
            if (patterns.some(p => lower.includes(p))) {
                return domain;
            }
        }

        return 'general';
    }

    private detectPlatform(message: string): string {
        const lower = message.toLowerCase();
        if (lower.includes('api') || lower.includes('endpoint') || lower.includes('rest')) return 'api';
        if (lower.includes('mobile') || lower.includes('ios') || lower.includes('android')) return 'mobile';
        return 'web';
    }

    // ─── Internal: Response Builders ──────────────────────────────────

    private buildClarificationResponse(
        session: ConversationSession,
        questions: ClarificationQuestion[]
    ): string {
        const domain = session.context.domain || 'general';
        const domainEmoji: Record<string, string> = {
            payment: '💳',
            auth: '🔐',
            checkout: '🛒',
            api: '🔌',
            general: '🧪',
        };

        let response = `${domainEmoji[domain] || '🧪'} **Got it!** I'll generate ${domain} tests for you.\n\n`;
        response += `To create the best test coverage, I need a few details:\n\n`;

        questions.forEach((q, i) => {
            response += `**${i + 1}. ${q.question}**\n`;
            if (q.options) {
                q.options.forEach((opt, j) => {
                    response += `   ${String.fromCharCode(97 + j)}) ${opt}\n`;
                });
            }
            response += '\n';
        });

        response += `_Session: ${session.id}_`;
        return response;
    }

    private buildReviewResponse(
        session: ConversationSession,
        scenarios: TestScenario[]
    ): string {
        let response = `🧪 **Generating via Qestro AI Engine...**\n\n`;
        response += `Created **${scenarios.length} test cases** for ${session.context.domain || 'your'} testing:\n\n`;

        scenarios.forEach((s, i) => {
            const typeEmoji: Record<string, string> = {
                happy_path: '✅',
                validation: '🛡️',
                edge_case: '🔄',
                negative: '❌',
                performance: '⚡',
                security: '🔒',
            };
            response += `${typeEmoji[s.type] || '✅'} **${s.id}**: ${s.name}\n`;
            response += `   _${s.description}_ | Priority: ${s.priority} | Steps: ${s.steps.length}\n\n`;
        });

        response += `\n---\n`;
        response += `Want me to **save all** to your test library, or would you like to modify some first?\n`;
        response += `_Session: ${session.id}_`;

        return response;
    }

    private buildFinalizedResponse(
        session: ConversationSession,
        savedScenarios: TestScenario[]
    ): string {
        let response = `✅ **${savedScenarios.length} test cases saved** to Qestro!\n\n`;

        savedScenarios.forEach(s => {
            response += `• **${s.id}**: ${s.name} (${s.priority})\n`;
        });

        response += `\n📊 Framework: ${session.context.framework || 'playwright'}\n`;
        response += `🌐 Platform: ${session.context.platform || 'web'}\n`;
        response += `🔬 Environment: ${session.context.environment || 'staging'}\n`;
        response += `\n_Want me to run them now?_\n`;
        response += `_Session: ${session.id}_`;

        return response;
    }

    // ─── Internal: Scenario Generation ────────────────────────────────

    private generateScenarios(session: ConversationSession): TestScenario[] {
        const ctx = session.context;
        const domain = ctx.domain || 'general';
        const scenarios: TestScenario[] = [];

        // Domain-specific scenario generators
        const generators: Record<string, () => TestScenario[]> = {
            payment: () => this.generatePaymentScenarios(ctx),
            auth: () => this.generateAuthScenarios(ctx),
            checkout: () => this.generateCheckoutScenarios(ctx),
            api: () => this.generateApiScenarios(ctx),
            general: () => this.generateGenericScenarios(ctx),
        };

        const generator = generators[domain] || generators.general;
        const generated = generator();

        // Filter by requested scenario types
        const requestedTypes = ctx.scenarioTypes || [];
        const typeMapping: Record<string, string[]> = {
            'Happy path only': ['happy_path'],
            'Happy path + Validation': ['happy_path', 'validation'],
            'Full coverage (happy + validation + edge cases)': ['happy_path', 'validation', 'edge_case', 'negative'],
            'Full coverage': ['happy_path', 'validation', 'edge_case', 'negative'],
            'Security-focused': ['security', 'negative'],
            'Happy path': ['happy_path'],
            'Validation & error handling': ['validation', 'negative'],
            'Edge cases': ['edge_case'],
        };

        let allowedTypes: string[] = [];
        for (const requested of requestedTypes) {
            const mapped = typeMapping[requested];
            if (mapped) allowedTypes.push(...mapped);
        }

        // If no specific types, include all
        if (allowedTypes.length === 0) {
            allowedTypes = ['happy_path', 'validation', 'edge_case', 'negative', 'security'];
        }

        for (const scenario of generated) {
            if (allowedTypes.includes(scenario.type)) {
                scenarios.push(scenario);
            }
        }

        return scenarios;
    }

    private generatePaymentScenarios(ctx: ConversationContext): TestScenario[] {
        const prefix = 'TC-PAY';
        let counter = 0;
        const scenarios: TestScenario[] = [];

        const methods = ctx.methods || ['Credit Card'];

        for (const method of methods) {
            if (method === 'All') {
                // Add representative for each
                scenarios.push(
                    this.makeScenario(prefix, ++counter, `Successful ${method} payment (Visa)`, 'happy_path', 'critical', [
                        { action: 'Navigate to payment page', expected: 'Payment form displayed' },
                        { action: 'Enter valid card details', expected: 'Card accepted' },
                        { action: 'Submit payment', expected: 'Payment processed successfully' },
                        { action: 'Verify confirmation', expected: 'Order confirmation displayed' },
                    ]),
                );
                continue;
            }

            scenarios.push(
                this.makeScenario(prefix, ++counter, `Successful ${method} payment`, 'happy_path', 'critical', [
                    { action: 'Navigate to payment page', expected: 'Payment form displayed' },
                    { action: `Select ${method}`, expected: `${method} input shown` },
                    { action: 'Enter valid details', expected: 'Details accepted' },
                    { action: 'Submit payment', expected: 'Payment successful' },
                ]),
            );
        }

        // Validation scenarios
        scenarios.push(
            this.makeScenario(prefix, ++counter, 'Expired card rejection', 'validation', 'high', [
                { action: 'Enter expired card', expected: 'Error: Card has expired' },
            ]),
            this.makeScenario(prefix, ++counter, 'Invalid CVV rejection', 'validation', 'high', [
                { action: 'Enter invalid CVV', expected: 'Error: Invalid security code' },
            ]),
            this.makeScenario(prefix, ++counter, 'Insufficient funds handling', 'validation', 'high', [
                { action: 'Submit payment with declined card', expected: 'Error: Insufficient funds' },
            ]),
        );

        // Edge cases
        scenarios.push(
            this.makeScenario(prefix, ++counter, '3DS authentication flow', 'edge_case', 'high', [
                { action: 'Submit card requiring 3DS', expected: '3DS challenge modal appears' },
                { action: 'Complete 3DS verification', expected: 'Payment processed after verification' },
            ]),
            this.makeScenario(prefix, ++counter, 'Duplicate payment prevention', 'edge_case', 'critical', [
                { action: 'Double-click submit', expected: 'Only one payment processed' },
            ]),
            this.makeScenario(prefix, ++counter, 'Payment timeout handling', 'edge_case', 'medium', [
                { action: 'Simulate gateway timeout', expected: 'Graceful timeout error shown' },
            ]),
        );

        // Security
        scenarios.push(
            this.makeScenario(prefix, ++counter, 'XSS in payment fields', 'security', 'critical', [
                { action: 'Enter script tags in name field', expected: 'Input sanitized, no XSS execution' },
            ]),
            this.makeScenario(prefix, ++counter, 'Card data not in URL/logs', 'security', 'critical', [
                { action: 'Complete payment flow', expected: 'No PCI data in URL params or console logs' },
            ]),
        );

        return scenarios;
    }

    private generateAuthScenarios(ctx: ConversationContext): TestScenario[] {
        const prefix = 'TC-AUTH';
        let counter = 0;
        const scenarios: TestScenario[] = [];

        scenarios.push(
            this.makeScenario(prefix, ++counter, 'Successful login with valid credentials', 'happy_path', 'critical', [
                { action: 'Navigate to login page', expected: 'Login form displayed' },
                { action: 'Enter valid email and password', expected: 'Fields accepted' },
                { action: 'Click login', expected: 'Redirected to dashboard' },
            ]),
            this.makeScenario(prefix, ++counter, 'Successful logout', 'happy_path', 'high', [
                { action: 'Click logout', expected: 'Redirected to login page, session cleared' },
            ]),
            this.makeScenario(prefix, ++counter, 'Invalid password rejection', 'validation', 'high', [
                { action: 'Enter wrong password', expected: 'Error: Invalid credentials' },
            ]),
            this.makeScenario(prefix, ++counter, 'Empty field validation', 'validation', 'medium', [
                { action: 'Submit empty form', expected: 'Validation errors for required fields' },
            ]),
            this.makeScenario(prefix, ++counter, 'Session persistence', 'edge_case', 'high', [
                { action: 'Login then refresh page', expected: 'User remains authenticated' },
            ]),
            this.makeScenario(prefix, ++counter, 'Brute force protection', 'security', 'critical', [
                { action: 'Attempt 10 failed logins', expected: 'Account temporarily locked' },
            ]),
            this.makeScenario(prefix, ++counter, 'SQL injection in login', 'security', 'critical', [
                { action: 'Enter SQL injection in email field', expected: 'Input sanitized, no data leakage' },
            ]),
        );

        return scenarios;
    }

    private generateCheckoutScenarios(ctx: ConversationContext): TestScenario[] {
        const prefix = 'TC-CART';
        let counter = 0;
        return [
            this.makeScenario(prefix, ++counter, 'Add item to cart', 'happy_path', 'critical', [
                { action: 'Click add to cart', expected: 'Item appears in cart, count updates' },
            ]),
            this.makeScenario(prefix, ++counter, 'Complete checkout flow', 'happy_path', 'critical', [
                { action: 'Add items, proceed to checkout', expected: 'Checkout page displayed' },
                { action: 'Enter shipping address', expected: 'Address accepted' },
                { action: 'Select shipping method', expected: 'Total updates' },
                { action: 'Enter payment and confirm', expected: 'Order placed successfully' },
            ]),
            this.makeScenario(prefix, ++counter, 'Apply valid coupon', 'happy_path', 'high', [
                { action: 'Enter valid coupon code', expected: 'Discount applied, total reduced' },
            ]),
            this.makeScenario(prefix, ++counter, 'Invalid coupon rejection', 'validation', 'medium', [
                { action: 'Enter expired coupon', expected: 'Error: Coupon expired or invalid' },
            ]),
            this.makeScenario(prefix, ++counter, 'Empty cart checkout prevention', 'edge_case', 'high', [
                { action: 'Try to checkout with empty cart', expected: 'Blocked with appropriate message' },
            ]),
            this.makeScenario(prefix, ++counter, 'Stock validation during checkout', 'edge_case', 'high', [
                { action: 'Checkout item that goes out of stock', expected: 'User notified, item removed' },
            ]),
        ];
    }

    private generateApiScenarios(ctx: ConversationContext): TestScenario[] {
        const prefix = 'TC-API';
        let counter = 0;
        return [
            this.makeScenario(prefix, ++counter, 'GET endpoint returns 200', 'happy_path', 'critical', [
                { action: 'Send GET request', expected: 'Status 200, valid JSON response' },
            ]),
            this.makeScenario(prefix, ++counter, 'POST create resource', 'happy_path', 'critical', [
                { action: 'Send POST with valid body', expected: 'Status 201, resource created' },
            ]),
            this.makeScenario(prefix, ++counter, 'PUT update resource', 'happy_path', 'high', [
                { action: 'Send PUT with updated data', expected: 'Status 200, resource updated' },
            ]),
            this.makeScenario(prefix, ++counter, 'DELETE resource', 'happy_path', 'high', [
                { action: 'Send DELETE request', expected: 'Status 200/204, resource removed' },
            ]),
            this.makeScenario(prefix, ++counter, 'Invalid body returns 400', 'validation', 'high', [
                { action: 'Send POST with invalid body', expected: 'Status 400, validation errors' },
            ]),
            this.makeScenario(prefix, ++counter, 'Unauthorized access returns 401', 'security', 'critical', [
                { action: 'Send request without auth token', expected: 'Status 401 Unauthorized' },
            ]),
            this.makeScenario(prefix, ++counter, 'Rate limiting is enforced', 'security', 'high', [
                { action: 'Send 100+ requests rapidly', expected: 'Status 429 after limit exceeded' },
            ]),
        ];
    }

    private generateGenericScenarios(ctx: ConversationContext): TestScenario[] {
        const prefix = 'TC-GEN';
        let counter = 0;
        return [
            this.makeScenario(prefix, ++counter, 'Page loads successfully', 'happy_path', 'critical', [
                { action: 'Navigate to target page', expected: 'Page loads without errors' },
            ]),
            this.makeScenario(prefix, ++counter, 'Primary action completes', 'happy_path', 'critical', [
                { action: 'Perform primary user action', expected: 'Action completes successfully' },
            ]),
            this.makeScenario(prefix, ++counter, 'Form validation works', 'validation', 'high', [
                { action: 'Submit form with invalid data', expected: 'Validation errors displayed' },
            ]),
            this.makeScenario(prefix, ++counter, 'Responsive layout', 'edge_case', 'medium', [
                { action: 'Resize viewport to mobile', expected: 'Layout adapts correctly' },
            ]),
        ];
    }

    private makeScenario(
        prefix: string,
        num: number,
        name: string,
        type: TestScenario['type'],
        priority: TestScenario['priority'],
        steps: TestScenario['steps']
    ): TestScenario {
        return {
            id: `${prefix}-${String(num).padStart(3, '0')}`,
            name,
            description: `${type.replace('_', ' ')} test: ${name}`,
            type,
            priority,
            steps,
            approved: false,
        };
    }

    // ─── Internal: Playwright Code Generation ─────────────────────────

    private generatePlaywrightCode(scenario: TestScenario, ctx: ConversationContext): string {
        const testName = scenario.name.replace(/'/g, "\\'");
        let code = `import { test, expect } from '@playwright/test';\n\n`;
        code += `test.describe('${scenario.id}: ${testName}', () => {\n`;
        code += `  test('${testName}', async ({ page }) => {\n`;

        if (ctx.targetUrl) {
            code += `    await page.goto('${ctx.targetUrl}');\n\n`;
        }

        for (const step of scenario.steps) {
            code += `    // ${step.action}\n`;
            code += `    // Expected: ${step.expected}\n`;

            // Generate reasonable placeholder code based on action keywords
            const action = step.action.toLowerCase();
            if (action.includes('navigate') || action.includes('go to')) {
                code += `    await page.goto('/');\n`;
            } else if (action.includes('click')) {
                code += `    await page.getByRole('button', { name: /submit/i }).click();\n`;
            } else if (action.includes('enter') || action.includes('type') || action.includes('input')) {
                code += `    await page.getByLabel(/input/i).fill('test-value');\n`;
            } else if (action.includes('submit')) {
                code += `    await page.getByRole('button', { name: /submit/i }).click();\n`;
            } else if (action.includes('verify') || action.includes('check') || action.includes('assert')) {
                code += `    await expect(page.locator('[data-testid="result"]')).toBeVisible();\n`;
            } else {
                code += `    // TODO: Implement action\n`;
            }
            code += '\n';
        }

        code += `  });\n`;
        code += `});\n`;

        return code;
    }

    // ─── Helpers ──────────────────────────────────────────────────────

    private generateSessionId(): string {
        const ts = Date.now().toString(36);
        const rand = Math.random().toString(36).substring(2, 8);
        return `conv_${ts}_${rand}`;
    }

    private pruneOldSessions(): void {
        if (this.sessions.size <= this.MAX_SESSIONS) return;

        const sorted = Array.from(this.sessions.entries())
            .sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());

        const toRemove = sorted.slice(0, this.sessions.size - this.MAX_SESSIONS);
        for (const [key, session] of toRemove) {
            if (['finalized', 'cancelled'].includes(session.phase)) {
                this.sessions.delete(key);
            }
        }
    }
}

export const conversationalTestService = ConversationalTestService.getInstance();
