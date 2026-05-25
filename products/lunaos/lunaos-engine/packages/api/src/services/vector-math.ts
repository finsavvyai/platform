/**
 * Vector Math — embedding generation, similarity scoring, and tokenization
 */

/**
 * Calculate cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Hash a vector for cache key generation.
 */
export function hashVector(vector: number[]): string {
    let hash = 0;
    for (const val of vector) {
        hash = (hash * 31) + Math.floor(val * 1000);
    }
    return hash.toString();
}

/**
 * Simple word-based tokenization for fallback embeddings.
 */
export function tokenizeText(text: string): number[] {
    const words = text.toLowerCase().split(/[^a-z]+/);
    const tokens: number[] = [];

    for (const word of words) {
        if (word.length > 0) {
            let token = 0;
            for (let i = 0; i < word.length; i++) {
                token = ((token * 31) + word.charCodeAt(i)) & 0x7fffffff;
            }
            tokens.push(token);
        }
    }

    return tokens;
}

/**
 * Generate a simple token-based embedding (fallback when no API key).
 */
export function generateFallbackEmbedding(text: string): number[] {
    const tokens = tokenizeText(text);
    const embedding = new Array(1536).fill(0);

    for (let i = 0; i < Math.min(tokens.length, 1536); i++) {
        embedding[i] = (tokens[i] * 31) % 256 / 255.0;
    }

    return embedding;
}

/**
 * Generate an OpenAI-style embedding using token hashing (simplified).
 */
export function generateSimpleEmbedding(text: string): number[] {
    const tokens = tokenizeText(text);
    const embedding = new Array(1536).fill(0);

    for (let i = 0; i < Math.min(tokens.length, 1536); i++) {
        embedding[i] = Math.sin(tokens[i] * 100) * 0.5;
    }

    return embedding;
}
