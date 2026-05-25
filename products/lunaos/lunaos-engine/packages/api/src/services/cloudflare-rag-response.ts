/**
 * Cloudflare RAG Response Generator — builds AI responses from context
 */

interface CloudflareRAGEnv {
    RAG_CACHE: KVNamespace;
    OPENAI_API_KEY: string;
    ENVIRONMENT: string;
}

interface RAGOptions {
    temperature?: number;
    maxTokens?: number;
    includeSources?: boolean;
    model?: string;
}

/**
 * Generate response using OpenAI-compatible API via fetch
 */
export async function generateRAGResponse(
    query: string,
    context: any[],
    options: RAGOptions,
    env: CloudflareRAGEnv,
): Promise<any> {
    try {
        const contextText = context
            .map(item => `Document: ${item.metadata.title}\nContent: ${item.content}`)
            .join('\n\n');

        const cacheKey = `generation:${hashString(query + contextText)}`;
        const cached = await env.RAG_CACHE.get(cacheKey, 'json') as { timestamp: number; response: any } | null;

        if (cached && cached.timestamp > Date.now() - 600000) {
            return cached.response;
        }

        const messages = [
            {
                role: 'system',
                content: `You are a helpful AI assistant that answers questions based on the provided context.
          Use the context to give accurate, specific answers. If the context doesn't contain relevant information,
          say so clearly. Always cite your sources when possible.`,
            },
            { role: 'user', content: `Context:\n${contextText}\n\nQuestion: ${query}` },
        ];

        const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: options.model || 'gpt-4',
                messages,
                temperature: options.temperature || 0.7,
                max_tokens: options.maxTokens || 2000,
            }),
        });

        const completion = await completionResponse.json() as any;

        const response = {
            answer: completion.choices?.[0]?.message?.content || '',
            sources: context.map(item => ({
                id: item.metadata.id,
                title: item.metadata.title,
                url: item.metadata.url,
                relevanceScore: item.score,
            })),
            query,
            context: contextText,
            confidence: calculateConfidence(context),
            metadata: {
                model: options.model || 'gpt-4',
                temperature: options.temperature || 0.7,
                maxTokens: options.maxTokens || 2000,
                processingTime: Date.now(),
                cacheHit: !!cached,
                environment: env.ENVIRONMENT,
            },
        };

        await env.RAG_CACHE.put(cacheKey, JSON.stringify({ timestamp: Date.now(), response }), { expirationTtl: 600 });
        return response;
    } catch (error) {
        console.error('Response generation failed:', error);
        throw error;
    }
}

function calculateConfidence(context: any[]): number {
    if (!context || context.length === 0) return 0;
    const avgScore = context.reduce((sum: number, item: any) => sum + (item.score || 0), 0) / context.length;
    return Math.min(avgScore, 1.0);
}

function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}
