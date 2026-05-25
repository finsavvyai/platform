const express = require('express');
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const { MongoClient } = require('mongodb');
const redis = require('redis');

const app = express();
const PORT = 3001;
app.use(express.json());

// Database connections
const postgresPool = new Pool({
  host: 'localhost',
  port: 5435,
  database: 'queryflux_test',
  user: 'testuser',
  password: 'testpass',
});

const mysqlConnection = mysql.createPool({
  host: 'localhost',
  port: 3309,
  database: 'queryflux_test',
  user: 'testuser',
  password: 'testpass',
});

const redisClient = redis.createClient({
  url: 'redis://localhost:6382'
});

const mongoClient = new MongoClient('mongodb://testuser:testpass@localhost:27019');

// Initialize Redis
redisClient.connect().catch(console.error);

// Test PostgreSQL connection
app.post('/api/test/postgresql', async (req, res) => {
  try {
    const result = await postgresPool.query('SELECT COUNT(*) FROM users');
    res.json({
      success: true,
      message: 'PostgreSQL connection successful',
      data: { userCount: parseInt(result.rows[0].count) }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Test MySQL connection
app.post('/api/test/mysql', async (req, res) => {
  try {
    const [rows] = await mysqlConnection.execute('SELECT COUNT(*) FROM users');
    res.json({
      success: true,
      message: 'MySQL connection successful',
      data: { userCount: rows[0]['COUNT(*)'] }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Test Redis connection
app.post('/api/test/redis', async (req, res) => {
  try {
    const result = await redisClient.ping();
    res.json({
      success: true,
      message: 'Redis connection successful',
      data: { ping: result }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Test MongoDB connection
app.post('/api/test/mongodb', async (req, res) => {
  try {
    await mongoClient.connect();
    const db = mongoClient.db('queryflux_test');
    const count = await db.collection('users').countDocuments();
    res.json({
      success: true,
      message: 'MongoDB connection successful',
      data: { documentCount: count }
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  } finally {
    await mongoClient.close();
  }
});

// Get database schema
app.get('/api/schema/:type', async (req, res) => {
  const { type } = req.params;

  try {
    let schema = {};

    switch(type) {
      case 'postgresql':
        const result = await postgresPool.query(`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'public'
          ORDER BY table_name, ordinal_position
        `);

        schema = result.rows.reduce((acc, row) => {
          if (!acc[row.table_name]) acc[row.table_name] = [];
          acc[row.table_name].push({
            column: row.column_name,
            type: row.data_type
          });
          return acc;
        }, {});
        break;

      case 'mysql':
        const [tables] = await mysqlConnection.execute(`
          SELECT table_name, column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = 'queryflux_test'
          ORDER BY table_name, ordinal_position
        `);

        schema = tables.reduce((acc, row) => {
          if (!acc[row.table_name]) acc[row.table_name] = [];
          acc[row.table_name].push({
            column: row.column_name,
            type: row.data_type
          });
          return acc;
        }, {});
        break;

      case 'mongodb':
        await mongoClient.connect();
        const db = mongoClient.db('queryflux_test');
        const collections = await db.listCollections().toArray();
        schema = {};

        for (const collection of collections) {
          const count = await db.collection(collection.name).countDocuments();
          schema[collection.name] = {
            type: 'collection',
            documentCount: count
          };
        }
        await mongoClient.close();
        break;
    }

    res.json({ success: true, schema });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 QueryFlux API Server running on http://localhost:${PORT}`);
});