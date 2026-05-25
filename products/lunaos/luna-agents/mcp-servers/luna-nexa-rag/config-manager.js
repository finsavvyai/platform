import { readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_PATH = join(homedir(), '.luna-nexa-rag-config.json');

export async function loadConfig() {
  try {
    const data = await readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    return {
      projectPath: process.env.PROJECT_PATH || process.cwd(),
      collectionName: process.env.COLLECTION_NAME || 'codebase',
      useNexaEmbeddings: process.env.USE_NEXA_EMBEDDINGS === 'true',
      nexaEndpoint: process.env.NEXA_ENDPOINT || 'http://localhost:8080',
      chromaHost: process.env.CHROMA_HOST || 'localhost',
      chromaPort: process.env.CHROMA_PORT || '8000',
      fileTypes: ['.js', '.ts', '.py', '.md', '.tsx', '.jsx', '.json', '.html', '.css', '.go', '.rs']
    };
  }
}

export async function saveConfig(config) {
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.error('✓ Config saved to ' + CONFIG_PATH);
}

export function getConfigPath() {
  return CONFIG_PATH;
}
