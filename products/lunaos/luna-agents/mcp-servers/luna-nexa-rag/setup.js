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
  console.log('\n🌙 Luna Nexa RAG Configuration Setup\n');
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
