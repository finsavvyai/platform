/**
 * Query Optimizer Service
 * Adapted from openhands-ai-engine (Apache-2.0)
 */
import { LLMClient } from '../lib/llm';

export class QueryOptimizer {
	constructor(private llm: LLMClient) {}

	async optimizeSQL(query: string, schema: string) {
		const prompt = `
Analyze and optimize the following SQL query for performance:

Query:
${query}

Schema:
${schema}

Return a JSON with: 'optimizedQuery', 'explanation', 'estimatedImprovement'.
`;

		return this.llm.completeJson<{
			optimizedQuery: string;
			explanation: string;
			estimatedImprovement: string;
		}>(prompt);
	}

	async nlToSQL(naturalLanguage: string, schema: string) {
		const prompt = `
Convert this natural language request to SQL:
"${naturalLanguage}"

Use this schema:
${schema}
`;

		return this.llm.complete(prompt, 'You are a SQL expert.');
	}
}
