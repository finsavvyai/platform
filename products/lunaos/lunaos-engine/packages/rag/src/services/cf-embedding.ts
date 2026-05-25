
import { EmbeddingService, ModelInfo } from '../interfaces';
import { EventEmitter } from 'events';

export interface CloudflareAiBinding {
    run(model: string, inputs: { text: string | string[] }): Promise<any>;
}

export class CloudflareEmbeddingService extends EventEmitter implements EmbeddingService {
    private binding: CloudflareAiBinding;
    private model: string;
    private dimension: number;

    constructor(config: {
        binding: CloudflareAiBinding;
        model?: string;
    }) {
        super();
        this.binding = config.binding;
        this.model = config.model || '@cf/baai/bge-base-en-v1.5';
        // BGE-base-en-v1.5 dimension is 768
        this.dimension = 768;
    }

    async generateEmbedding(text: string, model?: string): Promise<number[]> {
        const modelToUse = model || this.model;
        try {
            const response = await this.binding.run(modelToUse, { text: [text] });
            // Response format from Workers AI for embeddings:
            // { shape: [1, 768], data: [[...]] } or just data: [[...]] depending on version
            // Usually it returns { data: [[...]] } or just array of arrays if multiple inputs

            if (response && response.data && Array.isArray(response.data) && Array.isArray(response.data[0])) {
                return response.data[0];
            }

            // Fallback for different response shapes
            if (Array.isArray(response) && Array.isArray(response[0])) {
                return response[0];
            }

            throw new Error('Unexpected response format from Cloudflare AI');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    async generateBatchEmbeddings(texts: string[], model?: string): Promise<number[][]> {
        const modelToUse = model || this.model;
        try {
            const response = await this.binding.run(modelToUse, { text: texts });

            if (response && response.data && Array.isArray(response.data)) {
                return response.data;
            }

            if (Array.isArray(response) && Array.isArray(response[0])) {
                return response;
            }

            throw new Error('Unexpected response format from Cloudflare AI');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    getDimension(model?: string): number {
        return this.dimension;
    }

    getModelInfo(model?: string): ModelInfo {
        return {
            name: model || this.model,
            dimension: this.dimension,
            maxTokens: 512, // BGE base limit
            capabilities: ['text', 'english']
        };
    }
}
