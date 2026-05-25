#!/usr/bin/env node

/**
 * Luna Nexa RAG - Demo Script
 * Tests the RAG functionality without MCP server
 */

import { ChromaClient } from 'chromadb';
import { readFile, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { loadConfig } from './config-manager.js';

console.log('🌙 Luna Nexa RAG Demo\n');

// Load configuration
let config;
try {
  config = await loadConfig();
  console.log('✅ Configuration loaded');
  console.log(`   Project: ${config.projectPath}`);
  console.log(`   ChromaDB: ${config.chromaHost}:${config.chromaPort}`);
  console.log(`   Collection: ${config.collectionName}\n`);
} catch (error) {
  console.error('❌ Failed to load configuration:', error.message);
  console.log('\n💡 Run `npm run setup` to configure Luna Nexa RAG first\n');
  process.exit(1);
}

// Connect to ChromaDB
let chromaClient;
let collection;

try {
  console.log('🔌 Connecting to ChromaDB...');
  chromaClient = new ChromaClient({
    path: `http://${config.chromaHost}:${config.chromaPort}`
  });
  
  // Get or create collection
  try {
    collection = await chromaClient.getCollection({ name: config.collectionName });
    console.log(`✅ Connected to collection: ${config.collectionName}\n`);
  } catch (error) {
    console.log(`⚠️  Collection '${config.collectionName}' not found`);
    console.log('💡 Creating new collection...');
    collection = await chromaClient.createCollection({ name: config.collectionName });
    console.log(`✅ Created collection: ${config.collectionName}\n`);
  }
} catch (error) {
  console.error('❌ Failed to connect to ChromaDB:', error.message);
  console.log('\n💡 Make sure ChromaDB is running:');
  console.log('   docker run -d -p 8000:8000 chromadb/chroma\n');
  process.exit(1);
}

// Check collection contents
try {
  const count = await collection.count();
  console.log(`📊 Collection Statistics:`);
  console.log(`   Total documents: ${count}`);
  
  if (count === 0) {
    console.log('\n⚠️  Collection is empty!');
    console.log('💡 Index your codebase first using the MCP server:');
    console.log('   1. Start the server: npm start');
    console.log('   2. Use the index_codebase tool from your IDE\n');
    process.exit(0);
  }
  
  console.log('✅ Collection has documents\n');
} catch (error) {
  console.error('❌ Failed to query collection:', error.message);
  process.exit(1);
}

// Test query
console.log('🔍 Testing semantic search...');
const testQuery = 'authentication login user';
console.log(`   Query: "${testQuery}"\n`);

try {
  const results = await collection.query({
    queryTexts: [testQuery],
    nResults: 3
  });
  
  if (results.documents && results.documents[0] && results.documents[0].length > 0) {
    console.log('✅ Search Results:\n');
    
    results.documents[0].forEach((doc, idx) => {
      const distance = results.distances[0][idx];
      const metadata = results.metadatas[0][idx];
      
      console.log(`${idx + 1}. File: ${metadata?.filePath || 'Unknown'}`);
      console.log(`   Similarity: ${(1 - distance).toFixed(3)}`);
      console.log(`   Preview: ${doc.substring(0, 100)}...`);
      console.log('');
    });
  } else {
    console.log('⚠️  No results found for query');
  }
} catch (error) {
  console.error('❌ Search failed:', error.message);
  process.exit(1);
}

console.log('🎉 Demo complete!\n');
console.log('📚 Available tools in MCP server:');
console.log('   - index_codebase: Index your project');
console.log('   - semantic_search: Search with natural language');
console.log('   - get_similar_implementations: Find similar code');
console.log('   - get_code_patterns: Discover patterns');
console.log('   - ai_code_review: AI code review');
console.log('   - ui_capture_screenshot: Capture UI screenshots');
console.log('   - ui_analyze_screenshot_hig: Apple HIG compliance');
console.log('   - And 19 more tools!\n');

console.log('🚀 Start the MCP server with: npm start\n');
