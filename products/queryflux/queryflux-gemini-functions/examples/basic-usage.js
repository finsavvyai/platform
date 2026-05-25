/**
 * QueryFlux with Google Gemini - Basic Usage Example
 *
 * This example shows how to use QueryFlux functions with Google Gemini API.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { getQueryFluxFunctions, executeQueryFluxFunction } from '../dist/index.js';
import dotenv from 'dotenv';

dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DATABASE_ID = process.env.DATABASE_ID || 'db-dev';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY environment variable is required');
  process.exit(1);
}

async function main() {
  console.log('🚀 QueryFlux with Google Gemini - Basic Usage Example\n');

  // Initialize Gemini
  const genai = new GoogleGenerativeAI(GEMINI_API_KEY);

  // Load QueryFlux function declarations
  const queryfluxFunctions = getQueryFluxFunctions();
  console.log(`✅ Loaded ${queryfluxFunctions.length} QueryFlux functions\n`);

  // Create model with QueryFlux functions
  const model = genai.getGenerativeModel({
    model: 'gemini-pro',
    tools: [{ functionDeclarations: queryfluxFunctions }],
  });

  // Start chat
  const chat = model.startChat();

  // Example 1: Get database schema
  console.log('📊 Example 1: Get Database Schema');
  console.log('User: "Show me the database schema"\n');

  let result = await chat.sendMessage(
    `Using QueryFlux, get the schema for database ${DATABASE_ID}`
  );

  // Handle function call
  if (result.response.functionCalls) {
    for (const call of result.response.functionCalls) {
      console.log(`🔧 Function called: ${call.name}`);
      console.log(`📝 Arguments: ${JSON.stringify(call.args, null, 2)}\n`);

      // Execute the function
      const functionResult = await executeQueryFluxFunction(call.name, call.args);
      console.log(`✅ Result:`);
      console.log(JSON.stringify(functionResult, null, 2));
      console.log('\n---\n');

      // Send function result back to Gemini
      result = await chat.sendMessage([{
        functionResponse: {
          name: call.name,
          response: functionResult,
        },
      }]);
    }
  }

  console.log(`💬 Gemini: ${result.response.text()}\n`);
  console.log('---\n');

  // Example 2: Execute SQL query
  console.log('📊 Example 2: Execute SQL Query');
  console.log('User: "Execute: SELECT * FROM users LIMIT 3"\n');

  result = await chat.sendMessage(
    `Using QueryFlux, execute this SQL query on ${DATABASE_ID}: SELECT * FROM users LIMIT 3`
  );

  if (result.response.functionCalls) {
    for (const call of result.response.functionCalls) {
      console.log(`🔧 Function called: ${call.name}`);
      const functionResult = await executeQueryFluxFunction(call.name, call.args);
      console.log(`✅ Found ${functionResult.row_count} rows in ${functionResult.execution_ms}ms\n`);

      result = await chat.sendMessage([{
        functionResponse: {
          name: call.name,
          response: functionResult,
        },
      }]);
    }
  }

  console.log(`💬 Gemini: ${result.response.text()}\n`);
  console.log('---\n');

  // Example 3: Natural language query
  console.log('📊 Example 3: Natural Language to SQL');
  console.log('User: "Show me all users created in the last 7 days"\n');

  result = await chat.sendMessage(
    `Using QueryFlux, convert this to SQL for ${DATABASE_ID}: "Show me all users created in the last 7 days"`
  );

  if (result.response.functionCalls) {
    for (const call of result.response.functionCalls) {
      console.log(`🔧 Function called: ${call.name}`);
      const functionResult = await executeQueryFluxFunction(call.name, call.args);
      console.log(`✅ Generated SQL with ${(functionResult.confidence * 100).toFixed(0)}% confidence:`);
      console.log(functionResult.sql);
      console.log();

      result = await chat.sendMessage([{
        functionResponse: {
          name: call.name,
          response: functionResult,
        },
      }]);
    }
  }

  console.log(`💬 Gemini: ${result.response.text()}\n`);
  console.log('---\n');

  // Example 4: Create migration
  console.log('📊 Example 4: Create Migration');
  console.log('User: "Create a migration to add an index on users.email"\n');

  result = await chat.sendMessage(
    `Using QueryFlux, create a migration for ${DATABASE_ID} to add an index on users.email`
  );

  if (result.response.functionCalls) {
    for (const call of result.response.functionCalls) {
      console.log(`🔧 Function called: ${call.name}`);
      const functionResult = await executeQueryFluxFunction(call.name, call.args);
      console.log(`✅ Migration generated:`);
      console.log('Up:', functionResult.up_migration);
      console.log('Down:', functionResult.down_migration);
      console.log();

      result = await chat.sendMessage([{
        functionResponse: {
          name: call.name,
          response: functionResult,
        },
      }]);
    }
  }

  console.log(`💬 Gemini: ${result.response.text()}\n`);
  console.log('✅ All examples completed!');
}

main().catch(console.error);
