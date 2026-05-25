/**
 * Connector Generator Service
 * Adapted from openhands-ai-engine (Apache-2.0)
 */
import { LLMClient } from '../lib/llm';

export class ConnectorGenerator {
	constructor(private llm: LLMClient) {}

	async generateConnector(spec: unknown, language: string) {
		const prompt = `
Generate a ${language} API connector based on the following API specification:
${JSON.stringify(spec, null, 2)}

The connector should:
1. Be production-ready code.
2. Handle authentication if defined in specs.
3. Follow best practices for the language.
4. Include comments explaining key parts.
`;

		const systemPrompt = 'You are an expert API engineer. Generate high-quality connector code.';
		const code = await this.llm.complete(prompt, systemPrompt);

		return {
			code,
			generatedAt: new Date().toISOString(),
			language,
		};
	}
}
