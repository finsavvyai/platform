/**
 * QueryLens Vectorize Worker
 *
 * Cloudflare Worker that manages schema embeddings for QueryLens NLP-to-SQL engine.
 * Provides REST API endpoints for:
 * - Inserting schema embeddings (tables, columns)
 * - Searching similar schema elements
 * - Managing vector index
 *
 * Environment variables required:
 * - OPENAI_API_KEY: For generating embeddings
 */

import { Ai } from '@cloudflare/ai-sdk';

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const ingressSecret = env.VECTORIZE_INGRESS_SECRET;
    if (ingressSecret && ingressSecret.length > 0) {
      if (request.headers.get('X-Vectorize-Ingress-Secret') !== ingressSecret) {
        return jsonResponse({ error: 'Unauthorized' }, corsHeaders, 401);
      }
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Health check
      if (path === '/health' && request.method === 'GET') {
        return jsonResponse({ status: 'healthy', vectorize: 'connected' }, corsHeaders);
      }

      // Insert embeddings
      if (path === '/embeddings' && request.method === 'POST') {
        return await handleInsertEmbeddings(request, env, corsHeaders);
      }

      // Search embeddings
      if (path === '/search' && request.method === 'POST') {
        return await handleSearch(request, env, corsHeaders);
      }

      // Get all vectors
      if (path === '/vectors' && request.method === 'GET') {
        return await handleListVectors(request, env, corsHeaders);
      }

      // Delete vectors
      if (path.startsWith('/vectors/') && request.method === 'DELETE') {
        return await handleDeleteVector(request, env, corsHeaders);
      }

      // Batch insert schema
      if (path === '/schema' && request.method === 'POST') {
        return await handleInsertSchema(request, env, corsHeaders);
      }

      const deleteSchemaMatch = path.match(/^\/schema\/database\/(.+)$/);
      if (deleteSchemaMatch && request.method === 'DELETE') {
        return await handleDeleteDatabaseSchema(deleteSchemaMatch[1], env, corsHeaders);
      }

      return jsonResponse({ error: 'Not found' }, corsHeaders, 404);

    } catch (error) {
      console.error('Worker error:', error);
      return jsonResponse(
        { error: error.message || 'Internal server error' },
        corsHeaders,
        500
      );
    }
  },
};

/**
 * Insert embeddings into Vectorize
 */
async function handleInsertEmbeddings(request, env, corsHeaders) {
  const { items } = await request.json();

  if (!Array.isArray(items) || items.length === 0) {
    return jsonResponse({ error: 'items must be a non-empty array' }, corsHeaders, 400);
  }

  // Generate embeddings for text using OpenAI
  const ai = new Ai(env.OPENAI_API_KEY);
  const vectors = [];

  for (const item of items) {
    // Skip if vector already provided
    if (item.values && Array.isArray(item.values)) {
      vectors.push({
        id: item.id,
        values: item.values,
        metadata: item.metadata || {},
      });
      continue;
    }

    // Generate embedding from text
    const text = item.text || item.name || '';
    if (!text) {
      continue;
    }

    const response = await ai.run('@cf/openai/text-embedding-ada-002', { text });
    const embedding = response.data[0];

    vectors.push({
      id: item.id,
      values: embedding,
      metadata: {
        ...item.metadata,
        text: text,
        type: item.type || 'unknown',
        timestamp: Date.now(),
      },
    });
  }

  // Insert into Vectorize
  const result = await env.VECTORIZE_INDEX.upsert(vectors);

  return jsonResponse({
    success: true,
    mutationId: result.mutationId,
    count: vectors.length,
    message: `${vectors.length} vectors inserted/updated`,
  }, corsHeaders);
}

/**
 * Search for similar vectors
 */
async function handleSearch(request, env, corsHeaders) {
  const { query, topK = 5, namespace } = await request.json();

  if (!query) {
    return jsonResponse({ error: 'query is required' }, corsHeaders, 400);
  }

  // Generate embedding for search query
  const ai = new Ai(env.OPENAI_API_KEY);
  const response = await ai.run('@cf/openai/text-embedding-ada-002', { text: query });
  const queryVector = response.data[0];

  // Search in Vectorize
  const matches = await env.VECTORIZE_INDEX.query(queryVector, {
    topK: Math.min(topK, 100),
    namespace: namespace || '',
    returnMetadata: true,
  });

  return jsonResponse({
    matches: matches.map((match) => ({
      id: match.id,
      score: match.score,
      metadata: match.metadata,
    })),
    query: query,
    count: matches.length,
  }, corsHeaders);
}

/**
 * List all vectors (for debugging/admin)
 */
async function handleListVectors(request, env, corsHeaders) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '100');
  const cursor = url.searchParams.get('cursor') || undefined;

  const result = await env.VECTORIZE_INDEX.list({
    limit: Math.min(limit, 1000),
    cursor,
  });

  return jsonResponse({
    vectors: result.matches || [],
    cursor: result.cursor,
    count: result.matches?.length || 0,
  }, corsHeaders);
}

/**
 * Delete a vector by ID
 */
async function handleDeleteVector(request, env, corsHeaders) {
  const url = new URL(request.url);
  const id = url.pathname.split('/vectors/')[1];

  if (!id) {
    return jsonResponse({ error: 'vector ID is required' }, corsHeaders, 400);
  }

  await env.VECTORIZE_INDEX.deleteById(id);

  return jsonResponse({
    success: true,
    id: id,
    message: 'Vector deleted',
  }, corsHeaders);
}

/**
 * Insert complete database schema
 */
async function handleInsertSchema(request, env, corsHeaders) {
  const { database, tables } = await request.json();

  if (!database || !Array.isArray(tables)) {
    return jsonResponse({ error: 'database and tables array required' }, corsHeaders, 400);
  }

  const ai = new Ai(env.OPENAI_API_KEY);
  const vectors = [];

  // Generate embeddings for tables
  for (const table of tables) {
    const tableText = `Table: ${table.name}. Description: ${table.description || 'A database table'}. Columns: ${table.columns?.map(c => c.name).join(', ') || 'none'}.`;

    const tableResponse = await ai.run('@cf/openai/text-embedding-ada-002', { text: tableText });
    const tableEmbedding = tableResponse.data[0];

    vectors.push({
      id: `${database}:${table.name}:table`,
      values: tableEmbedding,
      metadata: {
        type: 'table',
        database: database,
        tableName: table.name,
        description: table.description || '',
        columns: table.columns?.map(c => c.name) || [],
        text: tableText,
      },
    });

    // Generate embeddings for columns
    for (const column of table.columns || []) {
      const columnText = `Column: ${column.name}. Type: ${column.type}. Description: ${column.description || ''}. Table: ${table.name}.`;

      const columnResponse = await ai.run('@cf/openai/text-embedding-ada-002', { text: columnText });
      const columnEmbedding = columnResponse.data[0];

      vectors.push({
        id: `${database}:${table.name}:${column.name}:column`,
        values: columnEmbedding,
        metadata: {
          type: 'column',
          database: database,
          tableName: table.name,
          columnName: column.name,
          columnType: column.type,
          description: column.description || '',
          text: columnText,
        },
      });
    }
  }

  // Insert all vectors
  const result = await env.VECTORIZE_INDEX.upsert(vectors);

  return jsonResponse({
    success: true,
    mutationId: result.mutationId,
    count: vectors.length,
    database: database,
    message: `Schema indexed with ${vectors.length} vectors`,
  }, corsHeaders);
}

/**
 * Best-effort delete of vectors for a database (id prefix "database:" or metadata.database).
 */
async function handleDeleteDatabaseSchema(encodedDatabase, env, corsHeaders) {
  const database = decodeURIComponent(encodedDatabase);
  const prefix = `${database}:`;
  let deleted = 0;
  let cursor;
  const maxPasses = 500;

  for (let pass = 0; pass < maxPasses; pass++) {
    const result = await env.VECTORIZE_INDEX.list({
      limit: 100,
      cursor,
      returnMetadata: true,
    });

    const matches = result.matches || [];
    if (matches.length === 0) {
      break;
    }

    for (const m of matches) {
      const id = m.id;
      const metaDb = m.metadata && m.metadata.database;
      if (id && (id.startsWith(prefix) || metaDb === database)) {
        await env.VECTORIZE_INDEX.deleteById(id);
        deleted++;
      }
    }

    if (!result.cursor) {
      break;
    }
    cursor = result.cursor;
  }

  return jsonResponse(
    {
      success: true,
      deleted,
      database,
      message: `removed ${deleted} vectors`,
    },
    corsHeaders
  );
}

/**
 * JSON response helper
 */
function jsonResponse(data, corsHeaders, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}
