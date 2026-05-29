/**
 * AI Query Assistant
 * Provides AI-powered database query assistance
 */

import * as vscode from 'vscode';
import { DatabaseConnection } from '../ultimateExtension';

export class AIQueryAssistant {
    private apiKey: string | undefined;
    private provider: string = 'openai';
    private model: string = 'gpt-3.5-turbo';
    private endpoint?: string;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadConfiguration();
    }

    async analyzeQuery(query: string, planJson?: any): Promise<string> {
        // Placeholder analysis; can be replaced with real API call
        const tips: string[] = [];
        if (/\bSELECT\b/i.test(query) && /\bWHERE\b/i.test(query) && /=/.test(query)) {
            tips.push('Consider indexes on equality-filtered columns in WHERE and JOIN conditions.');
        }
        if (planJson) {
            try {
                const root = Array.isArray(planJson) ? planJson[0] : planJson;
                const plan = root?.Plan ?? root;
                const walk = (n: any, out: string[]) => {
                    if (!n) {return;}
                    if (n['Node Type'] === 'Seq Scan' && n['Plans'] === null) {
                        const rel = n['Relation Name'] || 'table';
                        out.push(`Sequential scan detected on ${rel}. Consider an index to support the filter.`);
                    }
                    if (n['Node Type'] === 'Nested Loop') {
                        out.push('Nested Loop join present. Ensure join keys are indexed to avoid quadratic behavior.');
                    }
                    (n['Plans'] || []).forEach((c: any) => walk(c, out));
                };
                const out: string[] = [];
                walk(plan, out);
                tips.push(...out);
            } catch {}
        }
        return tips.length ? tips.map((t, i) => `- ${t}`).join('\n') : 'No obvious issues detected from quick heuristics.';
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('ultimatedb.ai');
        this.apiKey = config.get<string>('apiKey');
        this.provider = config.get<string>('provider', 'OpenAI');
        this.model = config.get<string>('model', this.provider === 'Anthropic' ? 'claude-3-5-sonnet-20240620' : 'gpt-4o-mini');
        this.endpoint = config.get<string>('endpoint');
    }

    async generateQuery(question: string, connection: DatabaseConnection): Promise<string> {
        if (!this.isEnabled() || !this.apiKey) {
            const examples = this.getQueryExamples(connection.type);
            return `-- AI Generated Query for: "${question}"
-- Database: ${connection.name} (${connection.type})
-- Generated at: ${new Date().toISOString()}

${examples[Math.floor(Math.random() * examples.length)]}

-- Note: Configure ultimatedb.ai.* settings to enable real AI.`;
        }

        const system = `You are an expert ${connection.type} SQL assistant. Generate safe, performant ${connection.type} queries. Output only the query.`;
        const user = `Schema context may be unknown. Task: ${question}`;
        const text = await this.callProvider(system, user);
        return text?.trim() || '-- AI returned no content';
    }

    private getQueryExamples(dbType: string): string[] {
        switch (dbType) {
            case 'PostgreSQL':
            case 'Oracle':
                return [
                    'SELECT * FROM users WHERE created_at >= NOW() - INTERVAL \'7 days\' LIMIT 100;',
                    'SELECT COUNT(*) FROM orders WHERE status = \'completed\';',
                    'SELECT u.name, COUNT(o.id) as order_count FROM users u LEFT JOIN orders o ON u.id = o.user_id GROUP BY u.id, u.name;'
                ];
            case 'MongoDB':
                return [
                    'db.users.find({ createdAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } }).limit(100);',
                    'db.orders.countDocuments({ status: "completed" });'
                ];
            case 'Redis':
                return [
                    'KEYS user:*',
                    'GET user:12345',
                    'HGETALL session:abc123'
                ];
            default:
                return ['SELECT 1;'];
        }
    }

    isEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('ultimatedb.ai');
        return config.get<boolean>('enabled', true) && !!this.apiKey;
    }

    private async callProvider(systemPrompt: string, userPrompt: string): Promise<string> {
        const axios = (await import('axios')).default;
        if (this.provider === 'Anthropic') {
            const url = this.endpoint || 'https://api.anthropic.com/v1/messages';
            const resp = await axios.post(url, {
                model: this.model,
                max_tokens: 800,
                system: systemPrompt,
                messages: [ { role: 'user', content: userPrompt } ]
            }, {
                headers: {
                    'x-api-key': this.apiKey!,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                }
            });
            const content = resp.data?.content?.[0]?.text;
            return content || '';
        }
        // Default OpenAI compatible
        const url = this.endpoint || 'https://api.openai.com/v1/chat/completions';
        const resp = await axios.post(url, {
            model: this.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.2,
            max_tokens: 800
        }, {
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                'content-type': 'application/json'
            }
        });
        const content = resp.data?.choices?.[0]?.message?.content;
        return content || '';
    }

    async analyzeQueryWithAI(query: string, planJson?: any): Promise<string> {
        if (!this.isEnabled() || !this.apiKey) {
            return 'AI disabled. Enable ultimatedb.ai.enabled and set apiKey.';
        }
        const system = 'You are a senior database performance engineer. Analyze queries and JSON execution plans; return concise, actionable tuning suggestions with bullet points.';
        const user = `Query:\n\n${query}\n\nPlan (JSON):\n\n${planJson ? JSON.stringify(planJson).slice(0, 3000) : 'N/A'}`;
        const out = await this.callProvider(system, user);
        return out || 'No analysis produced.';
    }
}
