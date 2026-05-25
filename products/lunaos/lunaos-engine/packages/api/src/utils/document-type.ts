/**
 * Document type utilities — maps file extensions to RAG document types
 */

import { DocumentType } from '@lunaos/rag';

const CODE_EXTENSIONS = new Set([
    'ts', 'js', 'py', 'go', 'rust', 'java', 'cpp', 'c', 'h', 'hpp', 'sh',
]);

const EXTENSION_MAP: Record<string, DocumentType> = {
    md: DocumentType.MARKDOWN,
    json: DocumentType.JSON,
    html: DocumentType.HTML,
    htm: DocumentType.HTML,
    csv: DocumentType.CSV,
    xml: DocumentType.XML,
};

export function getDocumentType(path: string): DocumentType {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (CODE_EXTENSIONS.has(ext)) return DocumentType.CODE;
    return EXTENSION_MAP[ext] ?? DocumentType.TEXT;
}
