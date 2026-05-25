
import type { D1Database } from '@cloudflare/workers-types';
import type {
    SearchAnalyticsEntry,
    SearchPerformanceStats,
    TopQueryEntry,
    KeywordSearchResult,
} from '../interfaces';

export interface MetadataStore {
    saveDocument(doc: { id: string; path: string; metadata: any }): Promise<void>;
    saveChunks(chunks: Array<{ id: string; documentId: string; content: string; index: number; metadata: any }>): Promise<void>;
    getChunk(id: string): Promise<{ content: string; metadata: any } | null>;
    getChunks(ids: string[]): Promise<Array<{ id: string; content: string; metadata: any }>>;
    deleteDocument(id: string): Promise<void>;
    searchByKeyword(keywords: string[], limit: number): Promise<KeywordSearchResult[]>;
    recordSearchAnalytics(entry: SearchAnalyticsEntry): Promise<void>;
    getSearchAnalytics(options?: { startDate?: number; endDate?: number; limit?: number }): Promise<SearchAnalyticsEntry[]>;
    getSearchPerformanceStats(): Promise<SearchPerformanceStats>;
    getTopQueries(limit: number): Promise<TopQueryEntry[]>;
}

export class D1MetadataStore implements MetadataStore {
    constructor(private db: D1Database) { }

    async saveDocument(doc: { id: string; path: string; metadata: any }): Promise<void> {
        await this.db.prepare(
            `INSERT OR REPLACE INTO documents (id, path, metadata, updated_at) VALUES (?, ?, ?, ?)`
        ).bind(doc.id, doc.path, JSON.stringify(doc.metadata), Date.now()).run();
    }

    async saveChunks(chunks: Array<{ id: string; documentId: string; content: string; index: number; metadata: any }>): Promise<void> {
        const stmt = this.db.prepare(
            `INSERT OR REPLACE INTO chunks (id, document_id, content, chunk_index, metadata) VALUES (?, ?, ?, ?, ?)`
        );

        // Batch execution
        const batch = chunks.map(chunk =>
            stmt.bind(chunk.id, chunk.documentId, chunk.content, chunk.index, JSON.stringify(chunk.metadata))
        );

        // Split into smaller batches if needed (D1 limit is usually 100 statements)
        const BATCH_SIZE = 50;
        for (let i = 0; i < batch.length; i += BATCH_SIZE) {
            await this.db.batch(batch.slice(i, i + BATCH_SIZE));
        }
    }

    async getChunk(id: string): Promise<{ content: string; metadata: any } | null> {
        const result = await this.db.prepare(
            `SELECT content, metadata FROM chunks WHERE id = ?`
        ).bind(id).first();

        if (!result) return null;

        return {
            content: result.content as string,
            metadata: JSON.parse(result.metadata as string)
        };
    }

    async getChunks(ids: string[]): Promise<Array<{ id: string; content: string; metadata: any }>> {
        if (ids.length === 0) return [];

        const placeholders = ids.map(() => '?').join(',');
        const results = await this.db.prepare(
            `SELECT id, content, metadata FROM chunks WHERE id IN (${placeholders})`
        ).bind(...ids).all();

        return (results.results || []).map((r: any) => ({
            id: r.id,
            content: r.content,
            metadata: JSON.parse(r.metadata)
        }));
    }

    async deleteDocument(id: string): Promise<void> {
        await this.db.batch([
            this.db.prepare(`DELETE FROM chunks WHERE document_id = ?`).bind(id),
            this.db.prepare(`DELETE FROM documents WHERE id = ?`).bind(id)
        ]);
    }

    async searchByKeyword(keywords: string[], limit: number): Promise<KeywordSearchResult[]> {
        if (keywords.length === 0) return [];

        const conditions = keywords.map(() => `content LIKE ?`).join(' OR ');
        const bindings = keywords.map(k => `%${k}%`);
        const sql = `SELECT id, document_id, content, metadata FROM chunks WHERE ${conditions} LIMIT ?`;

        const result = await this.db.prepare(sql).bind(...bindings, limit).all();
        const rows = result.results || [];

        return rows.map((row: any) => {
            const content = row.content as string;
            const matchCount = keywords.filter(k =>
                content.toLowerCase().includes(k.toLowerCase())
            ).length;

            return {
                id: row.id as string,
                documentId: row.document_id as string,
                content,
                score: matchCount / keywords.length,
                metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
            };
        }).sort((a, b) => b.score - a.score);
    }

    async recordSearchAnalytics(entry: SearchAnalyticsEntry): Promise<void> {
        const id = entry.id ?? crypto.randomUUID();
        await this.db.prepare(
            `INSERT INTO search_analytics (id, query_text, result_count, latency_ms, cache_hit, search_type) VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(
            id,
            entry.queryText,
            entry.resultCount,
            entry.latencyMs,
            entry.cacheHit ? 1 : 0,
            entry.searchType,
        ).run();
    }

    async getSearchAnalytics(
        options?: { startDate?: number; endDate?: number; limit?: number }
    ): Promise<SearchAnalyticsEntry[]> {
        let sql = `SELECT * FROM search_analytics WHERE 1=1`;
        const bindings: unknown[] = [];

        if (options?.startDate) {
            sql += ` AND created_at >= ?`;
            bindings.push(options.startDate);
        }
        if (options?.endDate) {
            sql += ` AND created_at <= ?`;
            bindings.push(options.endDate);
        }
        sql += ` ORDER BY created_at DESC LIMIT ?`;
        bindings.push(options?.limit ?? 100);

        const result = await this.db.prepare(sql).bind(...bindings).all();
        return (result.results || []).map((r: any) => ({
            id: r.id,
            queryText: r.query_text,
            resultCount: r.result_count,
            latencyMs: r.latency_ms,
            cacheHit: r.cache_hit === 1,
            searchType: r.search_type,
            createdAt: r.created_at,
        }));
    }

    async getSearchPerformanceStats(): Promise<SearchPerformanceStats> {
        const result = await this.db.prepare(`
            SELECT
                COUNT(*) as total,
                AVG(latency_ms) as avg_latency,
                AVG(result_count) as avg_results,
                SUM(CASE WHEN cache_hit = 1 THEN 1 ELSE 0 END) as cache_hits
            FROM search_analytics
        `).first();

        const total = (result?.total as number) || 0;
        const cacheHits = (result?.cache_hits as number) || 0;

        const p95Result = await this.db.prepare(`
            SELECT latency_ms FROM search_analytics
            ORDER BY latency_ms DESC
            LIMIT 1 OFFSET ?
        `).bind(Math.max(0, Math.floor(total * 0.05))).first();

        return {
            totalSearches: total,
            avgLatencyMs: Math.round((result?.avg_latency as number) || 0),
            p95LatencyMs: (p95Result?.latency_ms as number) || 0,
            cacheHitRate: total > 0 ? cacheHits / total : 0,
            avgResultCount: Math.round((result?.avg_results as number) || 0),
        };
    }

    async getTopQueries(limit: number): Promise<TopQueryEntry[]> {
        const result = await this.db.prepare(`
            SELECT query_text, COUNT(*) as cnt, AVG(latency_ms) as avg_lat
            FROM search_analytics
            GROUP BY query_text
            ORDER BY cnt DESC
            LIMIT ?
        `).bind(limit).all();

        return (result.results || []).map((r: any) => ({
            queryText: r.query_text,
            count: r.cnt,
            avgLatencyMs: Math.round(r.avg_lat),
        }));
    }
}
