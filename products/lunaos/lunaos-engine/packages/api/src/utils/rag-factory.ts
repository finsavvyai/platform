import { RAGFactory, RAGEngineConfig, D1MetadataStore, SearchAnalyticsService } from '@lunaos/rag';
import { Env } from '../worker';

export function getSearchAnalytics(env: Env): SearchAnalyticsService {
    const store = new D1MetadataStore(env.DB);
    return new SearchAnalyticsService(store);
}

export async function getRAGEngine(env: Env) {
    const docProcessorConfig = {
        chunkingStrategy: 'semantic',
        chunkSize: 512,
        chunkOverlap: 50,
        maxChunkSize: 1000,
        extractMetadata: true,
        detectLanguage: true,
        extractEntities: false
    } as const;

    const config: RAGEngineConfig = {
        vectorDatabase: {
            provider: 'cloudflare',
            dimension: 768,
            metric: 'cosine',
            indexName: 'luna-index'
        },
        embeddingService: {
            provider: 'cloudflare',
            model: '@cf/baai/bge-base-en-v1.5',
            dimension: 768,
            batchSize: 10,
            cache: true
        },
        documentProcessor: docProcessorConfig,
        documentProcessing: docProcessorConfig,
        cache: {
            enabled: false,
            provider: 'memory',
            ttl: 3600,
            maxSize: 100
        },
        security: {
            encryption: false,
            accessControl: false,
            auditLogging: false,
            rateLimiting: false,
            dataPrivacy: false
        },
        monitoring: {
            enabled: false,
            metricsProvider: 'console',
            logLevel: 'info',
            alerting: false
        }
    };

    return RAGFactory.createRAGEngine(config, { env });
}
