// RAG module barrel exports for the SDLC.ai JavaScript SDK

export { RAGClient } from "./client";
export * from "./types";

// Backward-compatible alias
import { RAGClient } from "./client";
export { RAGClient as RAGService };
