/**
 * Simple logger for the RAG package
 * Uses console.* for Cloudflare Workers compatibility
 */
export const logger = {
    debug: (message: string, meta?: any) => {
        if (meta) console.debug(`[RAG] ${message}`, meta);
        else console.debug(`[RAG] ${message}`);
    },
    info: (message: string, meta?: any) => {
        if (meta) console.info(`[RAG] ${message}`, meta);
        else console.info(`[RAG] ${message}`);
    },
    warn: (message: string, meta?: any) => {
        if (meta) console.warn(`[RAG] ${message}`, meta);
        else console.warn(`[RAG] ${message}`);
    },
    error: (message: string, err?: any) => {
        if (err) console.error(`[RAG] ${message}`, err);
        else console.error(`[RAG] ${message}`);
    },
};
