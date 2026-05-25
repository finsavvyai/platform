/**
 * Traffic Analyst Service
 * Adapted from openhands-ai-engine (Apache-2.0)
 */
import { LLMClient } from '../lib/llm';

export class TrafficAnalyst {
	constructor(private llm: LLMClient) {}

	async analyzeError(errorLog: string, context: string) {
		const prompt = `
Analyze the following API error and suggest a fix or comprehensive explanation:

Error Log:
${errorLog}

Context:
${context}

Provide your response in JSON format with fields: 'analysis', 'rootCause', 'suggestedFix'.
`;

		return this.llm.completeJson<{
			analysis: string;
			rootCause: string;
			suggestedFix: string;
		}>(prompt);
	}

	async generateOpenAPISpec(trafficSamples: unknown[]) {
		const prompt = `
Generate an OpenAPI 3.0 specification snippet based on the following request/response traffic samples:

${JSON.stringify(trafficSamples, null, 2)}
`;

		return this.llm.complete(prompt, 'You are an API documentation expert.');
	}
}
