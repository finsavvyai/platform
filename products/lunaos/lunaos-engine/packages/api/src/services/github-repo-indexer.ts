/**
 * GitHub Repo Indexer — fetches repo files from GitHub API and indexes via RAG
 */

import type { Env } from '../worker';

const SOURCE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'h',
  'hpp', 'cs', 'rb', 'php', 'swift', 'kt', 'scala', 'sh', 'bash',
  'md', 'json', 'yaml', 'yml', 'toml', 'sql', 'html', 'css', 'scss',
]);

const EXCLUDE_PATHS = [
  'node_modules/', 'dist/', 'build/', '.next/', '.git/',
  'vendor/', 'target/', '__pycache__/', '.venv/',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
];

const MAX_FILES = 50;
const BATCH_SIZE = 10;
const MAX_FILE_SIZE = 100_000;

function isSourceFile(item: any): boolean {
  if (item.type !== 'blob' || item.size > MAX_FILE_SIZE) return false;
  const ext = item.path.split('.').pop()?.toLowerCase() || '';
  if (!SOURCE_EXTENSIONS.has(ext)) return false;
  return !EXCLUDE_PATHS.some((ex) => item.path.includes(ex));
}

export async function fetchRepoTree(
  fullName: string,
  token: string,
): Promise<any[]> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LunaOS-Engine/1.0',
  };

  const res = await fetch(
    `https://api.github.com/repos/${fullName}/git/trees/HEAD?recursive=1`,
    { headers },
  );

  if (!res.ok) throw new Error(`Failed to fetch repo tree: ${res.status}`);
  const data = (await res.json()) as any;
  return (data.tree || []).filter(isSourceFile);
}

export async function fetchFileContents(
  fullName: string,
  sourceFiles: any[],
  token: string,
): Promise<Array<{ path: string; content: string }>> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'LunaOS-Engine/1.0',
  };

  const filesToIndex = sourceFiles.slice(0, MAX_FILES);
  const files: Array<{ path: string; content: string }> = [];

  for (let i = 0; i < filesToIndex.length; i += BATCH_SIZE) {
    const batch = filesToIndex.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (file: any) => {
        try {
          const res = await fetch(
            `https://api.github.com/repos/${fullName}/contents/${file.path}`,
            { headers },
          );
          if (!res.ok) return null;
          const data = (await res.json()) as any;
          if (data.encoding !== 'base64' || !data.content) return null;
          const decoded = atob(data.content.replace(/\n/g, ''));
          return { path: `${fullName}/${file.path}`, content: decoded };
        } catch {
          return null;
        }
      }),
    );
    files.push(...(results.filter(Boolean) as any[]));
  }

  return files;
}

export async function indexFilesViaRAG(
  env: Env,
  files: Array<{ path: string; content: string }>,
  fullName: string,
  owner: string,
): Promise<any> {
  const { getRAGEngine } = await import('../utils/rag-factory');
  const ragEngine = await getRAGEngine(env);

  const rawDocs = files.map((f) => ({
    id: f.path,
    title: f.path.split('/').pop() || f.path,
    content: f.content,
    source: f.path,
    type: 'code' as const,
    metadata: { repo: fullName, owner, path: f.path },
  }));

  return ragEngine.ingestDocuments(rawDocs as any);
}
