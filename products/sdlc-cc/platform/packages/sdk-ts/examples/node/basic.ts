// Basic usage example for Node.js

import { createClient } from '@sdlc/sdln-js';
import { promises as fs } from 'fs';

async function main() {
  // Create client
  const client = createClient({
    baseURL: 'https://api.sdlc.cc',
    apiKey: process.env.SDLC_API_KEY,
    environment: 'development'
  });

  try {
    // Authenticate
    console.log('Authenticating...');
    const { user } = await client.auth.login({
      email: 'user@example.com',
      password: 'password123'
    });
    console.log(`Logged in as: ${user.firstName} ${user.lastName}`);

    // Get users
    console.log('\nFetching users...');
    const users = await client.users.list({ pageSize: 10 });
    console.log(`Found ${users.total} users`);

    // Upload a document (if file exists)
    try {
      const fileContent = await fs.readFile('./example.txt', 'utf-8');
      console.log('\nUploading document...');

      // Create a buffer to simulate a file
      const buffer = Buffer.from(fileContent);
      const blob = new Blob([buffer], { type: 'text/plain' });

      const document = await client.documents.upload(blob, {
        name: 'Example Document',
        tags: ['example', 'test']
      });

      console.log(`Document uploaded: ${document.id}`);
    } catch (err) {
      console.log('Skipping document upload (no example.txt found)');
    }

    // Query RAG
    console.log('\nQuerying RAG...');
    const ragResponse = await client.rag.query({
      query: 'What is SDLC.ai?',
      context: {
        maxDocuments: 5
      }
    });
    console.log('Answer:', ragResponse.answer);

    // Search vectors
    console.log('\nSearching vectors...');
    const searchResults = await client.vector.search({
      query: 'AI platform',
      topK: 10
    });
    console.log(`Found ${searchResults.length} results`);

    // Get system health
    console.log('\nChecking system health...');
    const isHealthy = await client.healthCheck();
    console.log(`System health: ${isHealthy ? 'OK' : 'NOT OK'}`);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.close();
  }
}

main();
