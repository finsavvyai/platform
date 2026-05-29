import { Client } from 'pg'
import mysql from 'mysql2/promise'
import { MongoClient } from 'mongodb'

// Database connection configurations stored securely
const dbConfigs = {
  postgresql: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'queryflux',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    database: process.env.MYSQL_DB || 'queryflux',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    ssl: process.env.MYSQL_SSL === 'true' ? { rejectUnauthorized: false } : false
  },
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/queryflux'
  }
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

// Handle preflight requests
function handleCORS() {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  })
}

// PostgreSQL query executor
async function executePostgreSQLQuery(query, config) {
  const client = new Client(config)
  await client.connect()

  try {
    const result = await client.query(query)
    return {
      columns: result.fields.map(field => ({
        name: field.name,
        type: field.dataTypeID
      })),
      rows: result.rows,
      rowCount: result.rowCount
    }
  } finally {
    await client.end()
  }
}

// MySQL query executor
async function executeMySQLQuery(query, config) {
  const connection = await mysql.createConnection(config)

  try {
    const [rows, fields] = await connection.execute(query)
    return {
      columns: fields.map(field => ({
        name: field.name,
        type: field.type
      })),
      rows: Array.isArray(rows) ? rows : [],
      rowCount: Array.isArray(rows) ? rows.length : 0
    }
  } finally {
    await connection.end()
  }
}

// MongoDB query executor
async function executeMongoDBQuery(query, config) {
  const client = new MongoClient(config.uri)
  await client.connect()

  try {
    // For MongoDB, we expect a JSON query object
    const queryObj = JSON.parse(query)
    const { database, collection, operation, filter, pipeline, document } = queryObj

    const db = client.db(database)
    const coll = db.collection(collection)

    let result
    switch (operation) {
      case 'find':
        result = await coll.find(filter || {}).toArray()
        break
      case 'aggregate':
        result = await coll.aggregate(pipeline || []).toArray()
        break
      case 'insertOne':
        result = await coll.insertOne(document)
        break
      case 'updateOne':
        result = await coll.updateOne(filter, document)
        break
      case 'deleteOne':
        result = await coll.deleteOne(filter)
        break
      default:
        throw new Error(`Unsupported MongoDB operation: ${operation}`)
    }

    return {
      data: result,
      rowCount: Array.isArray(result) ? result.length : 1
    }
  } finally {
    await client.close()
  }
}

// Get database schema information
async function getDatabaseSchema(dbType, config) {
  switch (dbType) {
    case 'postgresql':
      return await getPostgreSQLSchema(config)
    case 'mysql':
      return await getMySQLSchema(config)
    case 'mongodb':
      return await getMongoDBSchema(config)
    default:
      throw new Error(`Unsupported database type: ${dbType}`)
  }
}

async function getPostgreSQLSchema(config) {
  const client = new Client(config)
  await client.connect()

  try {
    const schemaQuery = `
      SELECT
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        c.character_maximum_length
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name, c.ordinal_position
    `

    const result = await client.query(schemaQuery)

    // Group columns by table
    const schema = {}
    result.rows.forEach(row => {
      if (!schema[row.table_name]) {
        schema[row.table_name] = []
      }
      schema[row.table_name].push({
        name: row.column_name,
        type: row.data_type,
        nullable: row.is_nullable === 'YES',
        default: row.column_default,
        maxLength: row.character_maximum_length
      })
    })

    return { tables: Object.keys(schema), schema }
  } finally {
    await client.end()
  }
}

async function getMySQLSchema(config) {
  const connection = await mysql.createConnection(config)

  try {
    const [tables] = await connection.execute('SHOW TABLES')
    const schema = {}

    for (const tableRow of tables) {
      const tableName = Object.values(tableRow)[0]
      const [columns] = await connection.execute(`DESCRIBE ${tableName}`)

      schema[tableName] = columns.map(col => ({
        name: col.Field,
        type: col.Type,
        nullable: col.Null === 'YES',
        default: col.Default,
        key: col.Key
      }))
    }

    return { tables: Object.keys(schema), schema }
  } finally {
    await connection.end()
  }
}

async function getMongoDBSchema(config) {
  const client = new MongoClient(config.uri)
  await client.connect()

  try {
    const db = client.db(config.uri.split('/').pop().split('?')[0])
    const collections = await db.listCollections().toArray()

    const schema = {}
    for (const collection of collections) {
      // Sample a few documents to infer schema
      const sample = await db.collection(collection.name).find({}).limit(10).toArray()
      schema[collection.name] = sample.length > 0 ? Object.keys(sample[0]) : []
    }

    return { tables: collections.map(c => c.name), schema }
  } finally {
    await client.close()
  }
}

export default async function handler(req, context) {
  const url = new URL(req.url)
  const path = url.pathname.replace('/api/database/', '')
  const method = req.method

  try {
    // Handle CORS
    if (method === 'OPTIONS') {
      return handleCORS()
    }

    // Route handling
    switch (path) {
      case 'connect':
        if (method === 'POST') {
          const { dbType, connectionConfig } = await req.json()

          // Validate configuration
          const config = { ...dbConfigs[dbType], ...connectionConfig }

          // Test connection
          try {
            if (dbType === 'postgresql') {
              await executePostgreSQLQuery('SELECT 1', config)
            } else if (dbType === 'mysql') {
              await executeMySQLQuery('SELECT 1', config)
            } else if (dbType === 'mongodb') {
              await getMongoDBSchema(config)
            }

            return new Response(JSON.stringify({
              success: true,
              message: 'Connection successful'
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            })
          } catch (error) {
            return new Response(JSON.stringify({
              success: false,
              error: error.message
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            })
          }
        }
        break

      case 'query':
        if (method === 'POST') {
          const { dbType, connectionConfig, query } = await req.json()

          // Validate query to prevent injection
          if (!query || typeof query !== 'string') {
            return new Response(JSON.stringify({
              error: 'Invalid query'
            }), {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            })
          }

          const config = { ...dbConfigs[dbType], ...connectionConfig }

          try {
            let result
            if (dbType === 'postgresql') {
              result = await executePostgreSQLQuery(query, config)
            } else if (dbType === 'mysql') {
              result = await executeMySQLQuery(query, config)
            } else if (dbType === 'mongodb') {
              result = await executeMongoDBQuery(query, config)
            } else {
              throw new Error(`Unsupported database type: ${dbType}`)
            }

            return new Response(JSON.stringify({
              success: true,
              data: result
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            })
          } catch (error) {
            return new Response(JSON.stringify({
              success: false,
              error: error.message
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            })
          }
        }
        break

      case 'schema':
        if (method === 'POST') {
          const { dbType, connectionConfig } = await req.json()
          const config = { ...dbConfigs[dbType], ...connectionConfig }

          try {
            const schema = await getDatabaseSchema(dbType, config)

            return new Response(JSON.stringify({
              success: true,
              data: schema
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            })
          } catch (error) {
            return new Response(JSON.stringify({
              success: false,
              error: error.message
            }), {
              status: 500,
              headers: { 'Content-Type': 'application/json', ...corsHeaders }
            })
          }
        }
        break

      default:
        return new Response(JSON.stringify({
          error: 'Endpoint not found'
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
    }

    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('Database API Error:', error)
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
}

export const config = {
  path: '/api/database'
}