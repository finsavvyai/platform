#!/bin/bash

# Luna RAG Complete Setup Script
# Run from: luna-agents/mcp-servers/luna-nexa-rag/

echo "🌙 Creating Luna RAG files..."
echo ""

# Create config-manager.js
cat > config-manager.js << 'EOF1'
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
EOF1

echo "✓ config-manager.js created"

# Create setup.js
cat > setup.js << 'EOF2'
#!/usr/bin/env node
import { createInterface } from 'readline';
import { saveConfig, getConfigPath, loadConfig } from './config-manager.js';
import { existsSync } from 'fs';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n🌙 Luna RAG Configuration Setup\n');
  console.log('This will create a config file at:', getConfigPath(), '\n');

  const existingConfig = await loadConfig();
  
  const projectPath = await question(
    `📁 Enter your project path (default: ${existingConfig.projectPath}): `
  ) || existingConfig.projectPath;

  if (!existsSync(projectPath)) {
    console.error(`\n❌ Error: Path "${projectPath}" does not exist`);
    process.exit(1);
  }

  const collectionName = await question(
    `🗄️  Enter collection name (default: ${existingConfig.collectionName}): `
  ) || existingConfig.collectionName;

  const useNexaInput = await question(
    `⚡ Use Nexa embeddings? (y/n, default: ${existingConfig.useNexaEmbeddings ? 'y' : 'n'}): `
  ) || (existingConfig.useNexaEmbeddings ? 'y' : 'n');
  const useNexaEmbeddings = useNexaInput.toLowerCase() === 'y';

  let nexaEndpoint = existingConfig.nexaEndpoint;
  if (useNexaEmbeddings) {
    nexaEndpoint = await question(
      `🔗 Nexa endpoint (default: ${existingConfig.nexaEndpoint}): `
    ) || existingConfig.nexaEndpoint;
  }

  const chromaHost = await question(
    `🗄️  ChromaDB host (default: ${existingConfig.chromaHost}): `
  ) || existingConfig.chromaHost;

  const chromaPort = await question(
    `🔌 ChromaDB port (default: ${existingConfig.chromaPort}): `
  ) || existingConfig.chromaPort;

  const config = {
    projectPath,
    collectionName,
    useNexaEmbeddings,
    nexaEndpoint,
    chromaHost,
    chromaPort,
    fileTypes: existingConfig.fileTypes
  };

  console.log('\n📝 Configuration:\n', JSON.stringify(config, null, 2));

  const confirm = await question('\n✅ Save this configuration? (y/n): ');
  
  if (confirm.toLowerCase() === 'y') {
    await saveConfig(config);
    console.log('\n🎉 Setup complete!');
    console.log('\nRestart Claude Desktop to use the new configuration.');
  } else {
    console.log('\n❌ Setup cancelled');
  }

  rl.close();
}

setup().catch(console.error);
EOF2

chmod +x setup.js
echo "✓ setup.js created"

# Update package.json
cat > package.json << 'EOF3'
{
  "name": "@luna-agents/luna-nexa-rag",
  "version": "1.0.0",
  "description": "Semantic code search MCP server for Luna Agents, powered by Nexa embeddings",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "setup": "node setup.js",
    "start": "node index.js"
  },
  "bin": {
    "luna-nexa-rag-setup": "./setup.js"
  },
  "keywords": [
    "luna-agents",
    "mcp",
    "rag",
    "semantic-search",
    "code-search",
    "claude",
    "chroma",
    "nexa"
  ],
  "author": "Shachar Solomon",
  "license": "MIT",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.4",
    "chromadb": "^1.9.2"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF3

echo "✓ package.json updated"

echo ""
echo "✅ Setup files created!"
echo ""
echo "📝 Next steps:"
echo "1. Update index.js to use config-manager.js"
echo "2. npm install"
echo "3. npm run setup"
echo ""