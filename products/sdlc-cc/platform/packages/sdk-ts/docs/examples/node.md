# Node.js Examples

Examples of using the SDLC.ai SDK in Node.js applications.

## Basic Setup

```typescript
// app.ts
import { NodeClient } from '@sdlc/sdln-js/node';
import { promises as fs } from 'fs';
import path from 'path';

const client = new NodeClient({
  baseURL: 'https://api.sdlc.cc',
  apiKey: process.env.SDLC_API_KEY,
  environment: 'production'
});

async function main() {
  try {
    // Example 1: Authenticate
    console.log('Authenticating...');
    await client.auth.login({
      email: 'user@example.com',
      password: process.env.PASSWORD
    });
    console.log('Authenticated successfully');

    // Example 2: Upload a document
    console.log('Uploading document...');
    const document = await client.uploadFileFromPath(
      path.join(__dirname, 'documents', 'contract.pdf'),
      {
        name: 'Service Contract 2024',
        metadata: {
          department: 'legal',
          contractType: 'service',
          effectiveDate: '2024-01-01'
        },
        tags: ['legal', 'contract', 'service'],
        onProgress: (progress) => {
          console.log(`Upload: ${progress.percentage}%`);
        }
      }
    );
    console.log(`Document uploaded: ${document.id}`);

    // Example 3: Wait for processing
    console.log('Waiting for document processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Example 4: Query with RAG
    console.log('Querying document...');
    const response = await client.rag.query({
      query: 'What is the termination clause in the contract?',
      context: {
        maxDocuments: 5,
        includeCitations: true
      },
      filters: {
        documentIds: [document.id]
      }
    });

    console.log('Answer:', response.answer);
    console.log('Sources:', response.sources.map(s => s.documentName));

    // Example 5: Generate embeddings
    console.log('Generating embeddings...');
    const embeddings = await client.generateEmbeddings([
      'This is a sample text',
      'Another sample text for embedding'
    ], {
      model: 'text-embedding-ada-002',
      batchSize: 100,
      onProgress: (completed, total) => {
        console.log(`Embeddings: ${completed}/${total}`);
      }
    });

    console.log(`Generated ${embeddings.length} embeddings`);
    console.log(`First embedding dimension: ${embeddings[0].length}`);

    // Example 6: Vector search
    console.log('Performing vector search...');
    const searchResults = await client.vector.search({
      query: 'contract termination',
      topK: 10,
      threshold: 0.7,
      searchType: 'semantic'
    });

    console.log(`Found ${searchResults.length} similar documents`);
    searchResults.forEach((result, index) => {
      console.log(`${index + 1}. ${result.documentName} (score: ${result.score})`);
    });

    // Example 7: Create and test policy
    console.log('Creating policy...');
    const policy = await client.policies.create({
      name: 'Document Access Policy',
      description: 'Controls access to sensitive documents',
      type: 'access',
      status: 'draft',
      rules: [{
        id: 'rule-1',
        name: 'Allow legal team access',
        condition: 'input.user.roles[_] == "legal"',
        effect: 'allow',
        priority: 1,
        resources: ['documents'],
        actions: ['read', 'write']
      }],
      version: 1,
      tenantId: 'tenant-123'
    });

    console.log(`Policy created: ${policy.id}`);

    // Example 8: Test policy
    console.log('Testing policy...');
    const testResults = await client.policies.test({
      policyId: policy.id,
      scenarios: [{
        name: 'Legal user access',
        input: {
          user: 'user-456',
          resource: 'document-789',
          action: 'read',
          context: { roles: ['legal'] }
        },
        expected: 'allow'
      }]
    });

    testResults.forEach(result => {
      console.log(`Test "${result.scenario}": ${result.passed ? 'PASSED' : 'FAILED'}`);
    });

    // Example 9: Get usage metrics
    console.log('Getting usage metrics...');
    const usage = await client.llm.getUsage({
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    });

    console.log(`Total tokens used: ${usage.totalTokens}`);
    console.log(`Total cost: $${usage.totalCost.toFixed(2)}`);
    console.log(`Total requests: ${usage.requests}`);

    // Example 10: Get health status
    console.log('Checking system health...');
    const health = await client.healthCheck();
    console.log(`System status: ${health.status}`);
    health.checks.forEach(check => {
      console.log(`- ${check.name}: ${check.status} (${check.duration}ms)`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.close();
  }
}

main();
```

## Express.js Integration

```typescript
// server.ts
import express from 'express';
import { NodeClient } from '@sdlc/sdln-js/node';
import multer from 'multer';

const app = express();
const upload = multer({ dest: 'uploads/' });

// Initialize SDLC client
const sdlc = new NodeClient({
  baseURL: process.env.SDLC_API_URL || 'https://api.sdlc.cc',
  apiKey: process.env.SDLC_API_KEY,
  timeout: 60000,
  retries: 3
});

// Middleware to ensure authentication
async function ensureAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!sdlc.auth.isAuthenticated()) {
    try {
      await sdlc.auth.login({
        email: process.env.SDLC_EMAIL!,
        password: process.env.SDLC_PASSWORD!
      });
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }
  next();
}

// Upload document endpoint
app.post('/api/documents', ensureAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const document = await sdlc.uploadFileFromPath(req.file.path, {
      name: req.body.name || req.file.originalname,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
      tags: req.body.tags ? JSON.parse(req.body.tags) : []
    });

    // Clean up temporary file
    await fs.unlink(req.file.path);

    res.json({ success: true, document });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Query documents endpoint
app.post('/api/query', ensureAuth, async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    const response = await sdlc.rag.query({
      query,
      ...options
    });

    res.json(response);
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stream query endpoint
app.post('/api/query/stream', ensureAuth, async (req, res) => {
  try {
    const { query, options = {} } = req.body;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    for await (const update of sdlc.streamRAGQuery({
      query,
      streaming: true,
      ...options
    })) {
      res.write(`data: ${JSON.stringify(update)}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Stream query error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const isHealthy = await sdlc.healthCheck();
    const version = await sdlc.getVersion();
    
    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

## CLI Tool

```typescript
// cli.ts
#!/usr/bin/env node

import { Command } from 'commander';
import { NodeClient } from '@sdlc/sdln-js/node';
import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

const program = new Command();

// Global options
program
  .name('sdlc-cli')
  .description('SDLC.ai CLI tool')
  .option('-k, --key <key>', 'API key')
  .option('-u, --url <url>', 'API base URL', 'https://api.sdlc.cc')
  .option('-e, --env <env>', 'Environment', 'production');

// Upload command
program
  .command('upload <file>')
  .description('Upload a document')
  .option('-n, --name <name>', 'Document name')
  .option('-t, --tags <tags>', 'Tags (comma-separated)')
  .option('-m, --metadata <metadata>', 'Metadata JSON')
  .action(async (file, options) => {
    const client = new NodeClient({
      baseURL: program.opts().url,
      apiKey: program.opts().key || process.env.SDLC_API_KEY,
      environment: program.opts().env
    });

    try {
      console.log(chalk.blue('Uploading document...'));
      
      const document = await client.uploadFileFromPath(file, {
        name: options.name,
        tags: options.tags ? options.tags.split(',') : [],
        metadata: options.metadata ? JSON.parse(options.metadata) : {},
        onProgress: (progress) => {
          process.stdout.write(`\rProgress: ${progress.percentage}%`);
        }
      });

      console.log('\n' + chalk.green(`✓ Document uploaded: ${document.id}`));
    } catch (error) {
      console.error(chalk.red('✗ Upload failed:'), error.message);
      process.exit(1);
    }
  });

// Query command
program
  .command('query <query>')
  .description('Query documents with RAG')
  .option('-d, --documents <docs>', 'Document IDs (comma-separated)')
  .option('-s, --stream', 'Stream response')
  .action(async (query, options) => {
    const client = new NodeClient({
      baseURL: program.opts().url,
      apiKey: program.opts().key || process.env.SDLC_API_KEY,
      environment: program.opts().env
    });

    try {
      if (options.stream) {
        console.log(chalk.blue('Streaming response...'));
        
        for await (const update of client.streamRAGQuery({
          query,
          filters: options.documents ? {
            documentIds: options.documents.split(',')
          } : undefined,
          streaming: true
        })) {
          if (update.status === 'processing' && update.progress) {
            process.stdout.write(`\rProgress: ${Math.round(update.progress * 100)}%`);
          } else if (update.status === 'completed') {
            console.log('\n' + chalk.green('Answer:'));
            console.log(update.result?.answer);
            
            if (update.result?.sources?.length) {
              console.log(chalk.blue('\nSources:'));
              update.result.sources.forEach((source, idx) => {
                console.log(`${idx + 1}. ${source.documentName}`);
              });
            }
            break;
          }
        }
      } else {
        console.log(chalk.blue('Querying...'));
        
        const response = await client.rag.query({
          query,
          filters: options.documents ? {
            documentIds: options.documents.split(',')
          } : undefined
        });

        console.log(chalk.green('Answer:'));
        console.log(response.answer);
        
        if (response.sources?.length) {
          console.log(chalk.blue('\nSources:'));
          response.sources.forEach((source, idx) => {
            console.log(`${idx + 1}. ${source.documentName} (score: ${source.score})`);
          });
        }
      }
    } catch (error) {
      console.error(chalk.red('✗ Query failed:'), error.message);
      process.exit(1);
    }
  });

// List documents command
program
  .command('list')
  .description('List documents')
  .option('-p, --page <page>', 'Page number', '1')
  .option('-l, --limit <limit>', 'Page size', '20')
  .option('-s, --search <search>', 'Search query')
  .action(async (options) => {
    const client = new NodeClient({
      baseURL: program.opts().url,
      apiKey: program.opts().key || process.env.SDLC_API_KEY,
      environment: program.opts().env
    });

    try {
      const response = await client.documents.list({
        page: parseInt(options.page),
        pageSize: parseInt(options.limit),
        search: options.search
      });

      console.log(chalk.blue(`Documents (${response.total} total):`));
      console.log();
      
      response.items.forEach((doc, idx) => {
        console.log(`${(response.page - 1) * response.pageSize + idx + 1}. ${doc.name}`);
        console.log(`   ID: ${doc.id}`);
        console.log(`   Type: ${doc.type}`);
        console.log(`   Size: ${(doc.size / 1024).toFixed(2)} KB`);
        console.log(`   Created: ${new Date(doc.createdAt).toLocaleString()}`);
        console.log();
      });
    } catch (error) {
      console.error(chalk.red('✗ Failed to list documents:'), error.message);
      process.exit(1);
    }
  });

program.parse();
```

## Batch Processing Script

```typescript
// batch-process.ts
import { NodeClient } from '@sdlc/sdln-js/node';
import { promises as fs } from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';

async function processDirectory(client: NodeClient, dirPath: string) {
  const files = await fs.readdir(dirPath, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isFile()) {
      const filePath = path.join(dirPath, file.name);
      const ext = path.extname(file.name).toLowerCase();
      
      if (['.pdf', '.docx', '.txt', '.md'].includes(ext)) {
        console.log(`Processing: ${file.name}`);
        
        try {
          // Upload document
          const document = await client.uploadFileFromPath(filePath, {
            name: file.name,
            metadata: {
              sourcePath: filePath,
              processedAt: new Date().toISOString()
            }
          });
          
          console.log(`✓ Uploaded: ${document.id}`);
          
          // Wait for processing
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Generate embeddings
          const content = await fs.readFile(filePath, 'utf-8');
          const chunks = content.split('\n\n').filter(chunk => chunk.length > 50);
          
          if (chunks.length > 0) {
            await client.generateEmbeddings(chunks, {
              batchSize: 10
            });
            
            console.log(`✓ Generated embeddings for ${chunks.length} chunks`);
          }
          
        } catch (error) {
          console.error(`✗ Failed to process ${file.name}:`, error.message);
        }
      }
    } else if (file.isDirectory()) {
      await processDirectory(client, path.join(dirPath, file.name));
    }
  }
}

async function main() {
  const client = new NodeClient({
    baseURL: process.env.SDLC_API_URL || 'https://api.sdlc.cc',
    apiKey: process.env.SDLC_API_KEY
  });

  // Authenticate
  await client.auth.login({
    email: process.env.SDLC_EMAIL!,
    password: process.env.SDLC_PASSWORD!
  });

  // Process directory
  const directory = process.argv[2] || './documents';
  console.log(`Processing directory: ${directory}`);
  
  await processDirectory(client, directory);
  console.log('Batch processing complete');
}

main();
```

To run these examples:

1. Install dependencies:
```bash
npm install @sdlc/sdln-js express multer commander chalk
```

2. Set environment variables:
```bash
export SDLC_API_KEY="your-api-key"
export SDLC_EMAIL="your-email@example.com"
export SDLC_PASSWORD="your-password"
```

3. Run the examples:
```bash
# Basic example
node examples/node/basic.ts

# Express server
node examples/node/server.ts

# CLI tool
node examples/node/cli.js upload document.pdf
node examples/node/cli.js query "What is in the document?"
node examples/node/cli.js list

# Batch processing
node examples/node/batch-process.ts ./documents
```