import { promises as fs } from 'fs';
import { join, relative, extname } from 'path';
import { RawDocument, DocumentType } from '../interfaces';

export interface FileScannerOptions {
    includePatterns?: string[];
    excludePatterns?: string[];
    followSymlinks?: boolean;
    maxFileSize?: number;
}

export class FileScannerService {
    private readonly defaultExcludePatterns = [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/.git/**',
        '**/.next/**',
        '**/coverage/**',
        '**/*.log',
        '**/.DS_Store'
    ];

    constructor(private options: FileScannerOptions = {}) { }

    async scanDirectory(directory: string): Promise<RawDocument[]> {
        const documents: RawDocument[] = [];
        const files = await this.walkDirectory(directory);

        for (const filePath of files) {
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                const relativePath = relative(directory, filePath);

                documents.push({
                    id: this.generateId(filePath),
                    content,
                    source: relativePath,
                    type: this.determineDocumentType(filePath),
                    metadata: {
                        filePath,
                        fileName: relativePath.split('/').pop() || '',
                        extension: extname(filePath)
                    },
                    createdAt: new Date()
                });
            } catch (error) {
                console.warn(`Failed to read file ${filePath}:`, error);
            }
        }

        return documents;
    }

    private async walkDirectory(dir: string): Promise<string[]> {
        const files: string[] = [];
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = join(dir, entry.name);

                if (entry.isDirectory()) {
                    if (this.shouldExclude(fullPath)) continue;
                    if (entry.isSymbolicLink() && !this.options.followSymlinks) continue;

                    files.push(...await this.walkDirectory(fullPath));
                } else if (entry.isFile()) {
                    if (this.shouldInclude(fullPath) && !this.shouldExclude(fullPath)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            console.warn(`Error scanning directory ${dir}:`, error);
        }
        return files;
    }

    private shouldExclude(path: string): boolean {
        const patterns = [...this.defaultExcludePatterns, ...(this.options.excludePatterns || [])];
        return patterns.some(pattern => this.matchPattern(path, pattern));
    }

    private shouldInclude(path: string): boolean {
        if (!this.options.includePatterns || this.options.includePatterns.length === 0) return true;
        return this.options.includePatterns.some(pattern => this.matchPattern(path, pattern));
    }

    private matchPattern(path: string, pattern: string): boolean {
        // Simple glob matching
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.');
        return new RegExp(regexPattern).test(path);
    }

    private generateId(filePath: string): string {
        return Buffer.from(filePath).toString('base64').replace(/=/g, '');
    }

    private determineDocumentType(filePath: string): DocumentType {
        const ext = extname(filePath).toLowerCase();
        switch (ext) {
            case '.md': return 'markdown' as DocumentType; // Type assertion needed if exact string not in enum/union
            case '.txt': return 'text' as DocumentType;
            case '.json': return 'json' as DocumentType;
            case '.ts':
            case '.js':
            case '.py':
                return 'code' as DocumentType;
            case '.pdf': return 'pdf' as DocumentType;
            case '.html': return 'html' as DocumentType;
            default: return 'text' as DocumentType;
        }
    }
}
