import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';

export interface ProjectContext {
    projectName: string;
    projectType: string;
    language: string;
    framework: string;
    files: FileInfo[];
    summary: string;
}

interface FileInfo {
    path: string;
    content: string;
    size: number;
}

const TYPE_DETECTORS: Array<{
    file: string;
    type: string;
    language: string;
    framework: string;
}> = [
        { file: 'package.json', type: 'node', language: 'typescript/javascript', framework: '' },
        { file: 'tsconfig.json', type: 'node', language: 'typescript', framework: '' },
        { file: 'next.config.mjs', type: 'node', language: 'typescript', framework: 'next.js' },
        { file: 'next.config.js', type: 'node', language: 'typescript', framework: 'next.js' },
        { file: 'vite.config.ts', type: 'node', language: 'typescript', framework: 'vite' },
        { file: 'wrangler.toml', type: 'cloudflare', language: 'typescript', framework: 'cloudflare workers' },
        { file: 'Cargo.toml', type: 'rust', language: 'rust', framework: '' },
        { file: 'go.mod', type: 'go', language: 'go', framework: '' },
        { file: 'pyproject.toml', type: 'python', language: 'python', framework: '' },
        { file: 'requirements.txt', type: 'python', language: 'python', framework: '' },
        { file: 'Gemfile', type: 'ruby', language: 'ruby', framework: 'rails' },
        { file: 'build.gradle', type: 'java', language: 'java/kotlin', framework: '' },
        { file: 'pom.xml', type: 'java', language: 'java', framework: 'maven' },
    ];

const SOURCE_EXTENSIONS = new Set([
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.py', '.go', '.rs', '.rb', '.java', '.kt',
    '.vue', '.svelte', '.astro',
    '.css', '.scss', '.less',
    '.sql', '.prisma', '.graphql',
    '.yaml', '.yml', '.toml',
    '.sh', '.bash',
]);

const IGNORE_DIRS = new Set([
    'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
    'target', 'vendor', '__pycache__', '.venv', 'venv',
    'coverage', '.turbo', '.cache', '.output',
    '.luna', '.idea', '.vscode',
]);

const MAX_FILE_SIZE = 15_000; // 15KB per file
const MAX_TOTAL_TOKENS = 20_000; // ~20K tokens — safe for all providers
const MAX_FILES = 30; // cap number of files

/**
 * Detect project type from files in the current directory
 */
function detectProject(cwd: string): { type: string; language: string; framework: string } {
    for (const detector of TYPE_DETECTORS) {
        if (fs.existsSync(path.join(cwd, detector.file))) {
            let framework = detector.framework;
            // Try to detect framework from package.json
            if (detector.file === 'package.json' && !framework) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf-8'));
                    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                    if (deps['next']) framework = 'next.js';
                    else if (deps['nuxt']) framework = 'nuxt';
                    else if (deps['@angular/core']) framework = 'angular';
                    else if (deps['vue']) framework = 'vue';
                    else if (deps['svelte']) framework = 'svelte';
                    else if (deps['express']) framework = 'express';
                    else if (deps['hono']) framework = 'hono';
                    else if (deps['fastify']) framework = 'fastify';
                    else if (deps['react']) framework = 'react';
                } catch { /* ignore */ }
            }
            return { type: detector.type, language: detector.language, framework };
        }
    }
    return { type: 'unknown', language: 'unknown', framework: '' };
}

/**
 * Gather project files for context injection into agent prompts
 */
export async function buildContext(cwd: string): Promise<ProjectContext> {
    const projectName = path.basename(cwd);
    const { type, language, framework } = detectProject(cwd);

    // Find source files (max 3 levels deep to avoid scanning monorepos)
    const allFiles = await glob('**/*', {
        cwd,
        nodir: true,
        ignore: [...IGNORE_DIRS].map(d => `**/${d}/**`),
        dot: false,
        maxDepth: 4,
    });

    // Filter to source files and read content
    let totalSize = 0;
    const files: FileInfo[] = [];

    // Prioritize certain files
    const priorityFiles = [
        'package.json', 'tsconfig.json', 'wrangler.toml',
        'prisma/schema.prisma', 'README.md',
    ];

    const sortedFiles = allFiles.sort((a, b) => {
        const aP = priorityFiles.includes(a) ? -1 : 0;
        const bP = priorityFiles.includes(b) ? -1 : 0;
        return aP - bP;
    });

    for (const file of sortedFiles) {
        if (files.length >= MAX_FILES) break;

        const ext = path.extname(file);
        if (!SOURCE_EXTENSIONS.has(ext)) continue;

        // Skip package.json in subdirectories (monorepo noise)
        const basename = path.basename(file);
        if (basename === 'package-lock.json') continue;

        const fullPath = path.join(cwd, file);
        try {
            const stat = fs.statSync(fullPath);
            if (stat.size > MAX_FILE_SIZE) continue;
            if (totalSize + stat.size > MAX_TOTAL_TOKENS * 4) break; // rough token estimate

            const content = fs.readFileSync(fullPath, 'utf-8');
            files.push({ path: file, content, size: stat.size });
            totalSize += stat.size;
        } catch { /* skip unreadable files */ }
    }

    const summary = [
        `Project: ${projectName}`,
        `Type: ${type}`,
        `Language: ${language}`,
        framework ? `Framework: ${framework}` : '',
        `Files analyzed: ${files.length}`,
        `Total size: ${(totalSize / 1024).toFixed(1)} KB`,
    ].filter(Boolean).join('\n');

    return { projectName, projectType: type, language, framework, files, summary };
}

/**
 * Format project context into a string for the LLM prompt
 */
export function formatContext(ctx: ProjectContext): string {
    const parts = [
        `# Project Context`,
        ``,
        ctx.summary,
        ``,
        `---`,
        ``,
    ];

    for (const file of ctx.files) {
        const ext = path.extname(file.path).slice(1);
        parts.push(`## ${file.path}`);
        parts.push('```' + ext);
        parts.push(file.content);
        parts.push('```');
        parts.push('');
    }

    return parts.join('\n');
}
