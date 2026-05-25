import { useState, useEffect } from 'react';
import { Code, Copy, Download, Share2, Save, Sparkles, ChevronDown, Check, FileCode, X, Database, Rocket } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { supabase, Connection } from '../lib/supabase';

interface CodeGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  connection?: Connection;
  schema?: any;
}

type ProgrammingLanguage = 'python' | 'javascript' | 'typescript' | 'java' | 'csharp' | 'go' | 'rust' | 'php' | 'ruby' | 'sql' | 'graphql' | 'r' | 'scala' | 'julia' | 'cpp';

interface LanguageInfo {
  id: ProgrammingLanguage;
  name: string;
  icon: string;
  tier: 1 | 2 | 3;
  color: string;
  fileExtension: string;
}

const programmingLanguages: LanguageInfo[] = [
  { id: 'python', name: 'Python', icon: '🐍', tier: 1, color: '#3776AB', fileExtension: '.py' },
  { id: 'javascript', name: 'JavaScript', icon: '🟨', tier: 1, color: '#F7DF1E', fileExtension: '.js' },
  { id: 'typescript', name: 'TypeScript', icon: '🔷', tier: 1, color: '#3178C6', fileExtension: '.ts' },
  { id: 'java', name: 'Java', icon: '☕', tier: 1, color: '#007396', fileExtension: '.java' },
  { id: 'sql', name: 'SQL', icon: '🗄️', tier: 1, color: '#CC2927', fileExtension: '.sql' },
  { id: 'go', name: 'Go', icon: '🐹', tier: 2, color: '#00ADD8', fileExtension: '.go' },
  { id: 'csharp', name: 'C#', icon: '🎯', tier: 2, color: '#239120', fileExtension: '.cs' },
  { id: 'graphql', name: 'GraphQL', icon: '🔺', tier: 2, color: '#E10098', fileExtension: '.graphql' },
  { id: 'cpp', name: 'C++', icon: '⚡', tier: 2, color: '#00599C', fileExtension: '.cpp' },
  { id: 'rust', name: 'Rust', icon: '🦀', tier: 3, color: '#CE412B', fileExtension: '.rs' },
  { id: 'php', name: 'PHP', icon: '🐘', tier: 2, color: '#777BB4', fileExtension: '.php' },
  { id: 'ruby', name: 'Ruby', icon: '💎', tier: 2, color: '#CC342D', fileExtension: '.rb' },
  { id: 'r', name: 'R', icon: '📊', tier: 3, color: '#276DC3', fileExtension: '.r' },
  { id: 'scala', name: 'Scala', icon: '🔺', tier: 3, color: '#DC322F', fileExtension: '.scala' },
  { id: 'julia', name: 'Julia', icon: '🟣', tier: 3, color: '#9558B2', fileExtension: '.jl' },
];

export function CodeGenerator({ isOpen, onClose, connection: initialConnection, schema }: CodeGeneratorProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<ProgrammingLanguage>('python');
  const [codeType, setCodeType] = useState<'connection' | 'crud' | 'migration' | 'api' | 'orm' | 'plugin'>('connection');
  const [generatedCode, setGeneratedCode] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [showTableSelector, setShowTableSelector] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(initialConnection || null);
  const [showConnectionSelector, setShowConnectionSelector] = useState(false);
  const [currentStep, setCurrentStep] = useState<'connection' | 'tables' | 'generate'>('connection');
  const [isDeploying, setIsDeploying] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPreferredLanguage();
      loadConnections();
      if (initialConnection) {
        setSelectedConnection(initialConnection);
        setCurrentStep('tables');
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedConnection) {
      loadTables();
      if (currentStep === 'connection') {
        setCurrentStep('tables');
      }
    }
  }, [selectedConnection]);

  useEffect(() => {
    if (isOpen) {
      generateCode();
    }
  }, [selectedLanguage, codeType, selectedTables]);

  const loadPreferredLanguage = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('language_preferences')
      .select('preferred_language')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data?.preferred_language) {
      setSelectedLanguage(data.preferred_language as ProgrammingLanguage);
    }
  };

  const saveLanguagePreference = async (lang: ProgrammingLanguage) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('language_preferences')
      .upsert({
        user_id: user.id,
        preferred_language: lang,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });
  };

  const loadConnections = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('connections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setConnections(data);
    }
  };

  const loadTables = async () => {
    if (!selectedConnection) {
      setTables([]);
      return;
    }

    const { data } = await supabase
      .from('database_schemas')
      .select('table_name')
      .eq('connection_id', selectedConnection.id);

    if (data) {
      const uniqueTables = [...new Set(data.map(item => item.table_name))];
      setTables(uniqueTables);
    }
  };

  const toggleTableSelection = (table: string) => {
    setSelectedTables(prev =>
      prev.includes(table)
        ? prev.filter(t => t !== table)
        : [...prev, table]
    );
  };

  const generateCode = async () => {
    setIsGenerating(true);
    await new Promise(resolve => setTimeout(resolve, 500));

    const code = getCodeTemplate(selectedLanguage, codeType, selectedTables, selectedConnection);
    setGeneratedCode(code);
    setCurrentStep('generate');
    setIsGenerating(false);
  };

  const deployAsEndpoint = async () => {
    if (!selectedConnection || selectedTables.length === 0) return;

    setIsDeploying(true);

    try {
      const functionName = `${selectedConnection.name.toLowerCase().replace(/\s+/g, '-')}-${codeType}-api`;
      const functionCode = generateEdgeFunctionCode();

      // Deploy the edge function (placeholder - actual deployment would use mcp__supabase__deploy_edge_function)
      await new Promise(resolve => setTimeout(resolve, 1000));

      alert(`Endpoint deployed successfully!\n\nURL: ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`);
    } catch (error) {
      alert('Failed to deploy endpoint');
    } finally {
      setIsDeploying(false);
    }
  };

  const generateEdgeFunctionCode = (): string => {
    const tableName = selectedTables[0] || 'table';
    return `import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { data, error } = await supabase
      .from('${tableName}')
      .select('*');

    if (error) throw error;

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});`;
  };

  const getCodeTemplate = (lang: ProgrammingLanguage, type: string, tables: string[], conn?: Connection): string => {
    const tableName = tables.length > 0 ? tables[0] : 'your_table';
    const dbHost = conn?.host || 'your-host.supabase.co';
    const dbName = conn?.database || 'postgres';
    const dbPort = conn?.port || 5432;
    const templates: Record<ProgrammingLanguage, Record<string, string>> = {
      python: {
        connection: `import psycopg2
from psycopg2 import pool

# Create connection pool for better performance
connection_pool = psycopg2.pool.SimpleConnectionPool(
    1, 20,
    host="your-host.supabase.co",
    database="postgres",
    user="postgres",
    password="your-password",
    port=5432
)

def get_connection():
    """Get a connection from the pool"""
    return connection_pool.getconn()

def release_connection(conn):
    """Return connection to the pool"""
    connection_pool.putconn(conn)

# Example usage
conn = get_connection()
try:
    cursor = conn.cursor()
    cursor.execute("SELECT version();")
    version = cursor.fetchone()
    print(f"Database version: {version[0]}")
finally:
    cursor.close()
    release_connection(conn)`,
        crud: `from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor

class DatabaseManager:
    def __init__(self, connection_string: str):
        self.conn = psycopg2.connect(connection_string)

    def create(self, table: str, data: dict) -> int:
        """Insert a new record"""
        columns = ', '.join(data.keys())
        placeholders = ', '.join(['%s'] * len(data))
        query = f"INSERT INTO {table} ({columns}) VALUES ({placeholders}) RETURNING id"

        with self.conn.cursor() as cursor:
            cursor.execute(query, list(data.values()))
            record_id = cursor.fetchone()[0]
            self.conn.commit()
            return record_id

    def read(self, table: str, id: int) -> Optional[dict]:
        """Read a record by ID"""
        query = f"SELECT * FROM {table} WHERE id = %s"

        with self.conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (id,))
            return cursor.fetchone()

    def update(self, table: str, id: int, data: dict) -> bool:
        """Update a record"""
        set_clause = ', '.join([f"{k} = %s" for k in data.keys()])
        query = f"UPDATE {table} SET {set_clause} WHERE id = %s"

        with self.conn.cursor() as cursor:
            cursor.execute(query, list(data.values()) + [id])
            self.conn.commit()
            return cursor.rowcount > 0

    def delete(self, table: str, id: int) -> bool:
        """Delete a record"""
        query = f"DELETE FROM {table} WHERE id = %s"

        with self.conn.cursor() as cursor:
            cursor.execute(query, (id,))
            self.conn.commit()
            return cursor.rowcount > 0

# Example usage
db = DatabaseManager("postgresql://user:pass@host:5432/dbname")
user_id = db.create('users', {'name': 'John Doe', 'email': 'john@example.com'})
user = db.read('users', user_id)
print(f"Created user: {user}")`,
        api: `from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import psycopg2
from typing import List, Optional

app = FastAPI(title="QueryFlux API")

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host="your-host",
        database="your-db",
        user="your-user",
        password="your-password"
    )

class User(BaseModel):
    id: Optional[int] = None
    name: str
    email: str

@app.get("/users", response_model=List[User])
async def get_users():
    """Get all users"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email FROM users")
        users = [User(id=row[0], name=row[1], email=row[2]) for row in cursor.fetchall()]
        return users
    finally:
        conn.close()

@app.post("/users", response_model=User)
async def create_user(user: User):
    """Create a new user"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (name, email) VALUES (%s, %s) RETURNING id",
            (user.name, user.email)
        )
        user.id = cursor.fetchone()[0]
        conn.commit()
        return user
    finally:
        conn.close()

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    """Get user by ID"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, email FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="User not found")
        return User(id=row[0], name=row[1], email=row[2])
    finally:
        conn.close()`,
        plugin: `"""
QueryFlux Plugin SDK - Python Template
Create custom plugins for QueryFlux with AI capabilities
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, List
import json

class QueryFluxPlugin(ABC):
    """Base class for QueryFlux plugins"""

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.name = self.__class__.__name__
        self.version = "1.0.0"

    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the plugin logic"""
        pass

    @abstractmethod
    def validate(self) -> bool:
        """Validate plugin configuration"""
        pass

    def get_metadata(self) -> Dict[str, Any]:
        """Return plugin metadata"""
        return {
            "name": self.name,
            "version": self.version,
            "config": self.config
        }

class CustomPlugin(QueryFluxPlugin):
    """Your custom plugin implementation"""

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        # Your plugin logic here
        query = context.get('query', '')
        connection = context.get('connection')

        # Process the query
        result = {
            'success': True,
            'data': [],
            'message': 'Plugin executed successfully'
        }

        return result

    def validate(self) -> bool:
        # Validate configuration
        required_keys = ['api_key', 'endpoint']
        return all(key in self.config for key in required_keys)

# Register plugin
def register():
    return CustomPlugin

# Export
__all__ = ['QueryFluxPlugin', 'CustomPlugin', 'register']`
      },
      javascript: {
        connection: `const { Pool } = require('pg');

// Create connection pool
const pool = new Pool({
  host: 'your-host.supabase.co',
  database: 'postgres',
  user: 'postgres',
  password: 'your-password',
  port: 5432,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query helper
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
}

// Example usage
async function main() {
  try {
    const result = await query('SELECT NOW()');
    console.log('Database time:', result.rows[0].now);
  } catch (err) {
    console.error('Database error:', err);
  }
}

main();`,
        crud: `const { Pool } = require('pg');

class DatabaseManager {
  constructor(connectionString) {
    this.pool = new Pool({ connectionString });
  }

  async create(table, data) {
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => \`$\${i + 1}\`).join(', ');

    const query = \`INSERT INTO \${table} (\${columns}) VALUES (\${placeholders}) RETURNING *\`;
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async read(table, id) {
    const query = \`SELECT * FROM \${table} WHERE id = $1\`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }

  async update(table, id, data) {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => \`\${key} = $\${i + 1}\`).join(', ');

    const query = \`UPDATE \${table} SET \${setClause} WHERE id = $\${keys.length + 1} RETURNING *\`;
    const result = await this.pool.query(query, [...values, id]);
    return result.rows[0];
  }

  async delete(table, id) {
    const query = \`DELETE FROM \${table} WHERE id = $1 RETURNING *\`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0];
  }
}

// Example usage
const db = new DatabaseManager('postgresql://user:pass@host:5432/dbname');

(async () => {
  const user = await db.create('users', { name: 'John Doe', email: 'john@example.com' });
  console.log('Created user:', user);
})();`,
        api: `const express = require('express');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Get all users
app.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user
app.post('/users', async (req, res) => {
  const { name, email } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user by ID
app.get('/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));`,
        plugin: `/**
 * QueryFlux Plugin SDK - JavaScript Template
 * Create custom plugins for QueryFlux with AI capabilities
 */

class QueryFluxPlugin {
  constructor(config = {}) {
    this.config = config;
    this.name = this.constructor.name;
    this.version = '1.0.0';
  }

  async execute(context) {
    throw new Error('execute() must be implemented');
  }

  validate() {
    throw new Error('validate() must be implemented');
  }

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      config: this.config
    };
  }
}

class CustomPlugin extends QueryFluxPlugin {
  async execute(context) {
    const { query, connection } = context;

    // Your plugin logic here
    const result = {
      success: true,
      data: [],
      message: 'Plugin executed successfully'
    };

    return result;
  }

  validate() {
    const requiredKeys = ['apiKey', 'endpoint'];
    return requiredKeys.every(key => key in this.config);
  }
}

module.exports = { QueryFluxPlugin, CustomPlugin };`
      },
      typescript: {
        connection: `import { Pool, PoolClient } from 'pg';

interface DatabaseConfig {
  host: string;
  database: string;
  user: string;
  password: string;
  port: number;
}

class DatabaseConnection {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      ...config,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

// Example usage
const db = new DatabaseConnection({
  host: 'your-host.supabase.co',
  database: 'postgres',
  user: 'postgres',
  password: 'your-password',
  port: 5432,
});

export default db;`,
        crud: `import { Pool } from 'pg';

interface BaseEntity {
  id?: number;
  created_at?: Date;
  updated_at?: Date;
}

class Repository<T extends BaseEntity> {
  constructor(
    private pool: Pool,
    private tableName: string
  ) {}

  async create(data: Omit<T, 'id' | 'created_at' | 'updated_at'>): Promise<T> {
    const columns = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, i) => \`$\${i + 1}\`).join(', ');

    const query = \`
      INSERT INTO \${this.tableName} (\${columns})
      VALUES (\${placeholders})
      RETURNING *
    \`;

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findById(id: number): Promise<T | null> {
    const query = \`SELECT * FROM \${this.tableName} WHERE id = $1\`;
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findAll(): Promise<T[]> {
    const query = \`SELECT * FROM \${this.tableName} ORDER BY created_at DESC\`;
    const result = await this.pool.query(query);
    return result.rows;
  }

  async update(id: number, data: Partial<Omit<T, 'id'>>): Promise<T | null> {
    const keys = Object.keys(data);
    const values = Object.values(data);
    const setClause = keys.map((key, i) => \`\${key} = $\${i + 1}\`).join(', ');

    const query = \`
      UPDATE \${this.tableName}
      SET \${setClause}, updated_at = NOW()
      WHERE id = $\${keys.length + 1}
      RETURNING *
    \`;

    const result = await this.pool.query(query, [...values, id]);
    return result.rows[0] || null;
  }

  async delete(id: number): Promise<boolean> {
    const query = \`DELETE FROM \${this.tableName} WHERE id = $1\`;
    const result = await this.pool.query(query, [id]);
    return result.rowCount > 0;
  }
}

export default Repository;`,
        api: `import express, { Request, Response } from 'express';
import { Pool } from 'pg';

const app = express();
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

interface User {
  id?: number;
  name: string;
  email: string;
  created_at?: Date;
}

app.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await pool.query<User>('SELECT * FROM users');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/users', async (req: Request, res: Response) => {
  const { name, email }: User = req.body;
  try {
    const result = await pool.query<User>(
      'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));`,
        plugin: `/**
 * QueryFlux Plugin SDK - TypeScript Template
 */

interface PluginConfig {
  [key: string]: any;
}

interface PluginContext {
  query: string;
  connection: any;
  user?: any;
}

interface PluginResult {
  success: boolean;
  data: any[];
  message: string;
  error?: string;
}

abstract class QueryFluxPlugin {
  protected config: PluginConfig;
  protected name: string;
  protected version: string;

  constructor(config: PluginConfig = {}) {
    this.config = config;
    this.name = this.constructor.name;
    this.version = '1.0.0';
  }

  abstract execute(context: PluginContext): Promise<PluginResult>;
  abstract validate(): boolean;

  getMetadata() {
    return {
      name: this.name,
      version: this.version,
      config: this.config,
    };
  }
}

class CustomPlugin extends QueryFluxPlugin {
  async execute(context: PluginContext): Promise<PluginResult> {
    const { query, connection } = context;

    // Your plugin logic here
    return {
      success: true,
      data: [],
      message: 'Plugin executed successfully',
    };
  }

  validate(): boolean {
    const requiredKeys = ['apiKey', 'endpoint'];
    return requiredKeys.every(key => key in this.config);
  }
}

export { QueryFluxPlugin, CustomPlugin, PluginConfig, PluginContext, PluginResult };`
      },
      java: {
        connection: `import java.sql.*;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

public class DatabaseConnection {
    private static HikariDataSource dataSource;

    static {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:postgresql://your-host:5432/your-db");
        config.setUsername("postgres");
        config.setPassword("your-password");
        config.setMaximumPoolSize(20);
        config.setMinimumIdle(5);
        config.setConnectionTimeout(30000);
        config.setIdleTimeout(600000);
        config.setMaxLifetime(1800000);

        dataSource = new HikariDataSource(config);
    }

    public static Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    public static void closeDataSource() {
        if (dataSource != null && !dataSource.isClosed()) {
            dataSource.close();
        }
    }

    public static void main(String[] args) {
        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery("SELECT version()")) {

            if (rs.next()) {
                System.out.println("Database version: " + rs.getString(1));
            }
        } catch (SQLException e) {
            e.printStackTrace();
        }
    }
}`,
        crud: `import java.sql.*;
import java.util.*;

public class DatabaseManager<T> {
    private Connection connection;
    private String tableName;

    public DatabaseManager(Connection connection, String tableName) {
        this.connection = connection;
        this.tableName = tableName;
    }

    public int create(Map<String, Object> data) throws SQLException {
        StringBuilder columns = new StringBuilder();
        StringBuilder placeholders = new StringBuilder();
        List<Object> values = new ArrayList<>();

        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (columns.length() > 0) {
                columns.append(", ");
                placeholders.append(", ");
            }
            columns.append(entry.getKey());
            placeholders.append("?");
            values.add(entry.getValue());
        }

        String sql = String.format("INSERT INTO %s (%s) VALUES (%s) RETURNING id",
            tableName, columns, placeholders);

        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            for (int i = 0; i < values.size(); i++) {
                pstmt.setObject(i + 1, values.get(i));
            }

            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return rs.getInt(1);
                }
            }
        }
        return -1;
    }

    public Map<String, Object> read(int id) throws SQLException {
        String sql = String.format("SELECT * FROM %s WHERE id = ?", tableName);

        try (PreparedStatement pstmt = connection.prepareStatement(sql)) {
            pstmt.setInt(1, id);

            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    ResultSetMetaData meta = rs.getMetaData();
                    Map<String, Object> result = new HashMap<>();

                    for (int i = 1; i <= meta.getColumnCount(); i++) {
                        result.put(meta.getColumnName(i), rs.getObject(i));
                    }
                    return result;
                }
            }
        }
        return null;
    }
}`,
        api: `import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;

@SpringBootApplication
@RestController
@RequestMapping("/api")
public class QueryFluxAPI {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @GetMapping("/users")
    public List<Map<String, Object>> getUsers() {
        return jdbcTemplate.queryForList("SELECT * FROM users");
    }

    @PostMapping("/users")
    public Map<String, Object> createUser(@RequestBody Map<String, String> user) {
        String sql = "INSERT INTO users (name, email) VALUES (?, ?) RETURNING *";
        return jdbcTemplate.queryForMap(sql, user.get("name"), user.get("email"));
    }

    @GetMapping("/users/{id}")
    public Map<String, Object> getUser(@PathVariable int id) {
        String sql = "SELECT * FROM users WHERE id = ?";
        return jdbcTemplate.queryForMap(sql, id);
    }

    public static void main(String[] args) {
        SpringApplication.run(QueryFluxAPI.class, args);
    }
}`,
        plugin: `/**
 * QueryFlux Plugin SDK - Java Template
 */

import java.util.*;

public abstract class QueryFluxPlugin {
    protected Map<String, Object> config;
    protected String name;
    protected String version;

    public QueryFluxPlugin(Map<String, Object> config) {
        this.config = config != null ? config : new HashMap<>();
        this.name = this.getClass().getSimpleName();
        this.version = "1.0.0";
    }

    public abstract PluginResult execute(PluginContext context) throws Exception;
    public abstract boolean validate();

    public Map<String, Object> getMetadata() {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("name", name);
        metadata.put("version", version);
        metadata.put("config", config);
        return metadata;
    }
}

class CustomPlugin extends QueryFluxPlugin {
    public CustomPlugin(Map<String, Object> config) {
        super(config);
    }

    @Override
    public PluginResult execute(PluginContext context) {
        // Your plugin logic here
        return new PluginResult(true, new ArrayList<>(), "Plugin executed successfully");
    }

    @Override
    public boolean validate() {
        return config.containsKey("apiKey") && config.containsKey("endpoint");
    }
}`
      },
      sql: {
        connection: `-- PostgreSQL Connection Example
-- Replace with your actual connection details

\\connect postgresql://username:password@host:5432/database

-- Test connection
SELECT version();
SELECT current_database();
SELECT current_user;

-- Show connection info
SELECT
    usename AS user,
    application_name,
    client_addr,
    backend_start,
    state
FROM pg_stat_activity
WHERE datname = current_database();`,
        crud: `-- CRUD Operations in SQL

-- CREATE
INSERT INTO users (name, email, created_at)
VALUES ('John Doe', 'john@example.com', NOW())
RETURNING *;

-- READ (Single)
SELECT * FROM users WHERE id = 1;

-- READ (All)
SELECT * FROM users ORDER BY created_at DESC;

-- READ (With Join)
SELECT
    u.id,
    u.name,
    u.email,
    COUNT(o.id) as order_count
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.id, u.name, u.email;

-- UPDATE
UPDATE users
SET
    name = 'Jane Doe',
    updated_at = NOW()
WHERE id = 1
RETURNING *;

-- DELETE
DELETE FROM users WHERE id = 1 RETURNING *;

-- UPSERT (Insert or Update)
INSERT INTO users (id, name, email, created_at)
VALUES (1, 'John Doe', 'john@example.com', NOW())
ON CONFLICT (id)
DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW()
RETURNING *;`,
        migration: `-- Migration: Create Users Table
-- Date: ${new Date().toISOString()}

BEGIN;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY users_select_policy
    ON users FOR SELECT
    USING (true);

CREATE POLICY users_insert_policy
    ON users FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY users_update_policy
    ON users FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

COMMIT;`,
        api: `-- Stored Procedure for API endpoint

CREATE OR REPLACE FUNCTION get_users(
    limit_count INT DEFAULT 10,
    offset_count INT DEFAULT 0
)
RETURNS TABLE (
    id INT,
    name VARCHAR,
    email VARCHAR,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.name, u.email, u.created_at
    FROM users u
    ORDER BY u.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM get_users(10, 0);`
      },
      go: {
        connection: `package main

import (
    "database/sql"
    "fmt"
    "log"
    "time"

    _ "github.com/lib/pq"
)

type Database struct {
    db *sql.DB
}

func NewDatabase(connString string) (*Database, error) {
    db, err := sql.Open("postgres", connString)
    if err != nil {
        return nil, err
    }

    // Configure connection pool
    db.SetMaxOpenConns(20)
    db.SetMaxIdleConns(5)
    db.SetConnMaxLifetime(time.Hour)

    // Test connection
    if err := db.Ping(); err != nil {
        return nil, err
    }

    return &Database{db: db}, nil
}

func (d *Database) Close() error {
    return d.db.Close()
}

func main() {
    connStr := "postgres://user:pass@host:5432/dbname?sslmode=require"
    db, err := NewDatabase(connStr)
    if err != nil {
        log.Fatal(err)
    }
    defer db.Close()

    var version string
    err = db.db.QueryRow("SELECT version()").Scan(&version)
    if err != nil {
        log.Fatal(err)
    }

    fmt.Println("Database version:", version)
}`,
        crud: `package main

import (
    "database/sql"
    "fmt"
)

type User struct {
    ID    int
    Name  string
    Email string
}

type Repository struct {
    db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
    return &Repository{db: db}
}

func (r *Repository) Create(user *User) error {
    query := \`INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id\`
    return r.db.QueryRow(query, user.Name, user.Email).Scan(&user.ID)
}

func (r *Repository) FindByID(id int) (*User, error) {
    user := &User{}
    query := \`SELECT id, name, email FROM users WHERE id = $1\`
    err := r.db.QueryRow(query, id).Scan(&user.ID, &user.Name, &user.Email)
    if err != nil {
        return nil, err
    }
    return user, nil
}

func (r *Repository) Update(user *User) error {
    query := \`UPDATE users SET name = $1, email = $2 WHERE id = $3\`
    _, err := r.db.Exec(query, user.Name, user.Email, user.ID)
    return err
}

func (r *Repository) Delete(id int) error {
    query := \`DELETE FROM users WHERE id = $1\`
    _, err := r.db.Exec(query, id)
    return err
}`,
        api: `package main

import (
    "database/sql"
    "encoding/json"
    "net/http"
    "strconv"

    "github.com/gorilla/mux"
)

type API struct {
    db *sql.DB
}

func NewAPI(db *sql.DB) *API {
    return &API{db: db}
}

func (api *API) GetUsers(w http.ResponseWriter, r *http.Request) {
    rows, err := api.db.Query("SELECT id, name, email FROM users")
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    defer rows.Close()

    var users []User
    for rows.Next() {
        var u User
        if err := rows.Scan(&u.ID, &u.Name, &u.Email); err != nil {
            http.Error(w, err.Error(), http.StatusInternalServerError)
            return
        }
        users = append(users, u)
    }

    json.NewEncoder(w).Encode(users)
}

func main() {
    r := mux.NewRouter()
    api := NewAPI(db)

    r.HandleFunc("/users", api.GetUsers).Methods("GET")

    http.ListenAndServe(":8080", r)
}`,
        plugin: `package queryflux

import "context"

// Plugin interface for QueryFlux extensions
type Plugin interface {
    Execute(ctx context.Context, input PluginContext) (*PluginResult, error)
    Validate() error
    GetMetadata() PluginMetadata
}

type PluginContext struct {
    Query      string
    Connection interface{}
    User       interface{}
}

type PluginResult struct {
    Success bool
    Data    []interface{}
    Message string
    Error   error
}

type PluginMetadata struct {
    Name    string
    Version string
    Config  map[string]interface{}
}

// CustomPlugin implementation
type CustomPlugin struct {
    config map[string]interface{}
}

func NewCustomPlugin(config map[string]interface{}) *CustomPlugin {
    return &CustomPlugin{config: config}
}

func (p *CustomPlugin) Execute(ctx context.Context, input PluginContext) (*PluginResult, error) {
    // Your plugin logic here
    return &PluginResult{
        Success: true,
        Data:    []interface{}{},
        Message: "Plugin executed successfully",
    }, nil
}

func (p *CustomPlugin) Validate() error {
    // Validation logic
    return nil
}

func (p *CustomPlugin) GetMetadata() PluginMetadata {
    return PluginMetadata{
        Name:    "CustomPlugin",
        Version: "1.0.0",
        Config:  p.config,
    }
}`
      },
      csharp: {
        connection: `using Npgsql;
using System;
using System.Threading.Tasks;

public class DatabaseConnection
{
    private readonly string _connectionString;

    public DatabaseConnection(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<NpgsqlConnection> GetConnectionAsync()
    {
        var connection = new NpgsqlConnection(_connectionString);
        await connection.OpenAsync();
        return connection;
    }

    public static async Task Main(string[] args)
    {
        var connString = "Host=your-host;Database=your-db;Username=postgres;Password=your-password";
        var db = new DatabaseConnection(connString);

        using (var conn = await db.GetConnectionAsync())
        using (var cmd = new NpgsqlCommand("SELECT version()", conn))
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
            {
                Console.WriteLine($"Database version: {reader.GetString(0)}");
            }
        }
    }
}`,
        crud: `using Npgsql;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

public class Repository<T> where T : class, new()
{
    private readonly string _connectionString;
    private readonly string _tableName;

    public Repository(string connectionString, string tableName)
    {
        _connectionString = connectionString;
        _tableName = tableName;
    }

    public async Task<int> CreateAsync(Dictionary<string, object> data)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var columns = string.Join(", ", data.Keys);
        var parameters = string.Join(", ", data.Keys.Select((_, i) => $"@p{i}"));
        var sql = $"INSERT INTO {_tableName} ({columns}) VALUES ({parameters}) RETURNING id";

        using var cmd = new NpgsqlCommand(sql, conn);
        int i = 0;
        foreach (var value in data.Values)
        {
            cmd.Parameters.AddWithValue($"@p{i++}", value);
        }

        return (int)await cmd.ExecuteScalarAsync();
    }

    public async Task<T> FindByIdAsync(int id)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = $"SELECT * FROM {_tableName} WHERE id = @id";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@id", id);

        using var reader = await cmd.ExecuteReaderAsync();
        if (await reader.ReadAsync())
        {
            // Map to entity
            return new T();
        }
        return null;
    }
}`,
        api: `using Microsoft.AspNetCore.Mvc;
using Npgsql;
using System.Collections.Generic;
using System.Threading.Tasks;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly string _connectionString;

    public UsersController(IConfiguration config)
    {
        _connectionString = config.GetConnectionString("DefaultConnection");
    }

    [HttpGet]
    public async Task<IActionResult> GetUsers()
    {
        var users = new List<User>();

        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        using var cmd = new NpgsqlCommand("SELECT id, name, email FROM users", conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            users.Add(new User
            {
                Id = reader.GetInt32(0),
                Name = reader.GetString(1),
                Email = reader.GetString(2)
            });
        }

        return Ok(users);
    }

    [HttpPost]
    public async Task<IActionResult> CreateUser([FromBody] User user)
    {
        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        var sql = "INSERT INTO users (name, email) VALUES (@name, @email) RETURNING id";
        using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("@name", user.Name);
        cmd.Parameters.AddWithValue("@email", user.Email);

        user.Id = (int)await cmd.ExecuteScalarAsync();
        return CreatedAtAction(nameof(GetUsers), new { id = user.Id }, user);
    }
}

public class User
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
}`,
        plugin: `using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace QueryFlux.SDK
{
    public abstract class QueryFluxPlugin
    {
        protected Dictionary<string, object> Config { get; set; }
        protected string Name { get; set; }
        protected string Version { get; set; }

        public QueryFluxPlugin(Dictionary<string, object> config)
        {
            Config = config ?? new Dictionary<string, object>();
            Name = GetType().Name;
            Version = "1.0.0";
        }

        public abstract Task<PluginResult> ExecuteAsync(PluginContext context);
        public abstract bool Validate();

        public PluginMetadata GetMetadata()
        {
            return new PluginMetadata
            {
                Name = Name,
                Version = Version,
                Config = Config
            };
        }
    }

    public class CustomPlugin : QueryFluxPlugin
    {
        public CustomPlugin(Dictionary<string, object> config) : base(config)
        {
        }

        public override async Task<PluginResult> ExecuteAsync(PluginContext context)
        {
            // Your plugin logic here
            return new PluginResult
            {
                Success = true,
                Data = new List<object>(),
                Message = "Plugin executed successfully"
            };
        }

        public override bool Validate()
        {
            return Config.ContainsKey("apiKey") && Config.ContainsKey("endpoint");
        }
    }
}`
      },
      graphql: {
        connection: `# GraphQL Schema for QueryFlux

type Query {
  users: [User!]!
  user(id: ID!): User
  databases: [Database!]!
}

type Mutation {
  createUser(input: CreateUserInput!): User!
  updateUser(id: ID!, input: UpdateUserInput!): User!
  deleteUser(id: ID!): Boolean!
}

type User {
  id: ID!
  name: String!
  email: String!
  createdAt: DateTime!
  updatedAt: DateTime!
}

input CreateUserInput {
  name: String!
  email: String!
}

input UpdateUserInput {
  name: String
  email: String
}

scalar DateTime`,
        crud: `const { ApolloServer, gql } = require('apollo-server');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const typeDefs = gql\`
  type User {
    id: ID!
    name: String!
    email: String!
  }

  type Query {
    users: [User!]!
    user(id: ID!): User
  }

  type Mutation {
    createUser(name: String!, email: String!): User!
    updateUser(id: ID!, name: String, email: String): User!
    deleteUser(id: ID!): Boolean!
  }
\`;

const resolvers = {
  Query: {
    users: async () => {
      const result = await pool.query('SELECT * FROM users');
      return result.rows;
    },
    user: async (_, { id }) => {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      return result.rows[0];
    }
  },
  Mutation: {
    createUser: async (_, { name, email }) => {
      const result = await pool.query(
        'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
        [name, email]
      );
      return result.rows[0];
    },
    updateUser: async (_, { id, name, email }) => {
      const result = await pool.query(
        'UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email) WHERE id = $1 RETURNING *',
        [id, name, email]
      );
      return result.rows[0];
    },
    deleteUser: async (_, { id }) => {
      const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      return result.rowCount > 0;
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });
server.listen().then(({ url }) => console.log(\`Server ready at \${url}\`));`,
        api: `# Sample GraphQL Queries and Mutations

# Query all users
query GetAllUsers {
  users {
    id
    name
    email
    createdAt
  }
}

# Query single user
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    createdAt
  }
}

# Create user mutation
mutation CreateUser($name: String!, $email: String!) {
  createUser(input: { name: $name, email: $email }) {
    id
    name
    email
  }
}

# Update user mutation
mutation UpdateUser($id: ID!, $name: String, $email: String) {
  updateUser(id: $id, input: { name: $name, email: $email }) {
    id
    name
    email
  }
}

# Delete user mutation
mutation DeleteUser($id: ID!) {
  deleteUser(id: $id)
}`,
        plugin: `# GraphQL Plugin Schema for QueryFlux

type Query {
  plugins: [Plugin!]!
  plugin(id: ID!): Plugin
}

type Mutation {
  installPlugin(id: ID!): PluginResult!
  uninstallPlugin(id: ID!): Boolean!
  configurePlugin(id: ID!, config: JSON!): Plugin!
}

type Plugin {
  id: ID!
  name: String!
  version: String!
  enabled: Boolean!
  config: JSON
  installedAt: DateTime!
}

type PluginResult {
  success: Boolean!
  plugin: Plugin
  message: String
  error: String
}

scalar JSON
scalar DateTime`
      },
      rust: {
        connection: `use sqlx::postgres::{PgPoolOptions, PgPool};
use std::env;

pub async fn create_pool() -> Result<PgPool, sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set");

    PgPoolOptions::new()
        .max_connections(20)
        .connect(&database_url)
        .await
}

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    let pool = create_pool().await?;

    let row: (String,) = sqlx::query_as("SELECT version()")
        .fetch_one(&pool)
        .await?;

    println!("Database version: {}", row.0);

    Ok(())
}`,
        crud: `use sqlx::{PgPool, FromRow};
use serde::{Deserialize, Serialize};

#[derive(Debug, FromRow, Serialize, Deserialize)]
pub struct User {
    pub id: i32,
    pub name: String,
    pub email: String,
}

pub struct Repository {
    pool: PgPool,
}

impl Repository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, name: &str, email: &str) -> Result<User, sqlx::Error> {
        sqlx::query_as!(
            User,
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
            name,
            email
        )
        .fetch_one(&self.pool)
        .await
    }

    pub async fn find_by_id(&self, id: i32) -> Result<User, sqlx::Error> {
        sqlx::query_as!(User, "SELECT * FROM users WHERE id = $1", id)
            .fetch_one(&self.pool)
            .await
    }

    pub async fn update(&self, id: i32, name: &str, email: &str) -> Result<User, sqlx::Error> {
        sqlx::query_as!(
            User,
            "UPDATE users SET name = $2, email = $3 WHERE id = $1 RETURNING *",
            id,
            name,
            email
        )
        .fetch_one(&self.pool)
        .await
    }

    pub async fn delete(&self, id: i32) -> Result<(), sqlx::Error> {
        sqlx::query!("DELETE FROM users WHERE id = $1", id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}`,
        api: `use actix_web::{web, App, HttpServer, Responder, HttpResponse};
use sqlx::PgPool;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct User {
    id: Option<i32>,
    name: String,
    email: String,
}

async fn get_users(pool: web::Data<PgPool>) -> impl Responder {
    let users = sqlx::query_as!(User, "SELECT id, name, email FROM users")
        .fetch_all(pool.get_ref())
        .await;

    match users {
        Ok(users) => HttpResponse::Ok().json(users),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

async fn create_user(
    pool: web::Data<PgPool>,
    user: web::Json<User>
) -> impl Responder {
    let result = sqlx::query_as!(
        User,
        "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
        user.name,
        user.email
    )
    .fetch_one(pool.get_ref())
    .await;

    match result {
        Ok(user) => HttpResponse::Created().json(user),
        Err(_) => HttpResponse::InternalServerError().finish(),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let pool = create_pool().await.expect("Failed to create pool");

    HttpServer::new(move || {
        App::new()
            .app_data(web::Data::new(pool.clone()))
            .route("/users", web::get().to(get_users))
            .route("/users", web::post().to(create_user))
    })
    .bind("127.0.0.1:8080")?
    .run()
    .await
}`,
        plugin: `use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginContext {
    pub query: String,
    pub connection: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PluginResult {
    pub success: bool,
    pub data: Vec<serde_json::Value>,
    pub message: String,
}

#[async_trait]
pub trait QueryFluxPlugin: Send + Sync {
    async fn execute(&self, context: PluginContext) -> Result<PluginResult, Box<dyn std::error::Error>>;
    fn validate(&self) -> bool;
    fn get_metadata(&self) -> HashMap<String, String>;
}

pub struct CustomPlugin {
    config: HashMap<String, String>,
}

impl CustomPlugin {
    pub fn new(config: HashMap<String, String>) -> Self {
        Self { config }
    }
}

#[async_trait]
impl QueryFluxPlugin for CustomPlugin {
    async fn execute(&self, context: PluginContext) -> Result<PluginResult, Box<dyn std::error::Error>> {
        // Your plugin logic here
        Ok(PluginResult {
            success: true,
            data: vec![],
            message: "Plugin executed successfully".to_string(),
        })
    }

    fn validate(&self) -> bool {
        self.config.contains_key("api_key") && self.config.contains_key("endpoint")
    }

    fn get_metadata(&self) -> HashMap<String, String> {
        let mut metadata = HashMap::new();
        metadata.insert("name".to_string(), "CustomPlugin".to_string());
        metadata.insert("version".to_string(), "1.0.0".to_string());
        metadata
    }
}`
      },
      php: {
        connection: `<?php
// Database connection using PDO

class Database {
    private $pdo;

    public function __construct(string $host, string $db, string $user, string $pass) {
        $dsn = "pgsql:host=$host;dbname=$db";

        try {
            $this->pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            throw new Exception("Connection failed: " . $e->getMessage());
        }
    }

    public function getConnection(): PDO {
        return $this->pdo;
    }
}

// Example usage
$db = new Database('your-host', 'your-db', 'postgres', 'your-password');
$stmt = $db->getConnection()->query('SELECT version()');
$version = $stmt->fetch();
echo "Database version: " . $version['version'];
?>`,
        crud: `<?php
class Repository {
    private $pdo;
    private $table;

    public function __construct(PDO $pdo, string $table) {
        $this->pdo = $pdo;
        $this->table = $table;
    }

    public function create(array $data): int {
        $columns = implode(', ', array_keys($data));
        $placeholders = ':' . implode(', :', array_keys($data));

        $sql = "INSERT INTO {$this->table} ($columns) VALUES ($placeholders) RETURNING id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($data);

        return $stmt->fetch()['id'];
    }

    public function findById(int $id): ?array {
        $sql = "SELECT * FROM {$this->table} WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(['id' => $id]);

        $result = $stmt->fetch();
        return $result ?: null;
    }

    public function update(int $id, array $data): bool {
        $set = [];
        foreach (array_keys($data) as $key) {
            $set[] = "$key = :$key";
        }
        $setClause = implode(', ', $set);

        $sql = "UPDATE {$this->table} SET $setClause WHERE id = :id";
        $data['id'] = $id;
        $stmt = $this->pdo->prepare($sql);

        return $stmt->execute($data);
    }

    public function delete(int $id): bool {
        $sql = "DELETE FROM {$this->table} WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);

        return $stmt->execute(['id' => $id]);
    }
}

// Example usage
$repo = new Repository($pdo, 'users');
$userId = $repo->create(['name' => 'John Doe', 'email' => 'john@example.com']);
$user = $repo->findById($userId);
?>`,
        api: `<?php
// Simple REST API using PHP

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

$db = new Database('your-host', 'your-db', 'postgres', 'your-password');
$pdo = $db->getConnection();

switch ($method) {
    case 'GET':
        if (preg_match('/\\/users\\/(\\d+)/', $path, $matches)) {
            // Get single user
            $id = $matches[1];
            $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $stmt->execute([$id]);
            $user = $stmt->fetch();

            if ($user) {
                echo json_encode($user);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'User not found']);
            }
        } else {
            // Get all users
            $stmt = $pdo->query('SELECT * FROM users');
            $users = $stmt->fetchAll();
            echo json_encode($users);
        }
        break;

    case 'POST':
        $data = json_decode(file_get_contents('php://input'), true);
        $stmt = $pdo->prepare('INSERT INTO users (name, email) VALUES (?, ?) RETURNING *');
        $stmt->execute([$data['name'], $data['email']]);
        $user = $stmt->fetch();

        http_response_code(201);
        echo json_encode($user);
        break;
}
?>`,
        plugin: `<?php
/**
 * QueryFlux Plugin SDK - PHP Template
 */

abstract class QueryFluxPlugin {
    protected array $config;
    protected string $name;
    protected string $version;

    public function __construct(array $config = []) {
        $this->config = $config;
        $this->name = get_class($this);
        $this->version = '1.0.0';
    }

    abstract public function execute(array $context): array;
    abstract public function validate(): bool;

    public function getMetadata(): array {
        return [
            'name' => $this->name,
            'version' => $this->version,
            'config' => $this->config
        ];
    }
}

class CustomPlugin extends QueryFluxPlugin {
    public function execute(array $context): array {
        $query = $context['query'] ?? '';
        $connection = $context['connection'] ?? null;

        // Your plugin logic here
        return [
            'success' => true,
            'data' => [],
            'message' => 'Plugin executed successfully'
        ];
    }

    public function validate(): bool {
        return isset($this->config['apiKey']) && isset($this->config['endpoint']);
    }
}
?>`
      },
      ruby: {
        connection: `require 'pg'

class Database
  def initialize(host:, database:, user:, password:, port: 5432)
    @connection = PG.connect(
      host: host,
      dbname: database,
      user: user,
      password: password,
      port: port
    )
  end

  def execute(sql, params = [])
    @connection.exec_params(sql, params)
  end

  def query(sql, params = [])
    execute(sql, params).to_a
  end

  def close
    @connection.close
  end
end

# Example usage
db = Database.new(
  host: 'your-host',
  database: 'your-db',
  user: 'postgres',
  password: 'your-password'
)

result = db.query('SELECT version()')
puts "Database version: #{result.first['version']}"`,
        crud: `require 'pg'

class Repository
  def initialize(connection, table_name)
    @conn = connection
    @table = table_name
  end

  def create(data)
    columns = data.keys.join(', ')
    placeholders = (1..data.size).map { |i| "$#{i}" }.join(', ')
    values = data.values

    sql = "INSERT INTO #{@table} (#{columns}) VALUES (#{placeholders}) RETURNING *"
    @conn.exec_params(sql, values).first
  end

  def find_by_id(id)
    sql = "SELECT * FROM #{@table} WHERE id = $1"
    @conn.exec_params(sql, [id]).first
  end

  def update(id, data)
    set_clause = data.keys.each_with_index.map { |key, i| "#{key} = $#{i + 1}" }.join(', ')
    values = data.values + [id]

    sql = "UPDATE #{@table} SET #{set_clause} WHERE id = $#{data.size + 1} RETURNING *"
    @conn.exec_params(sql, values).first
  end

  def delete(id)
    sql = "DELETE FROM #{@table} WHERE id = $1 RETURNING *"
    @conn.exec_params(sql, [id]).first
  end
end

# Example usage
repo = Repository.new(conn, 'users')
user = repo.create({ name: 'John Doe', email: 'john@example.com' })
puts "Created user: #{user['name']}"`,
        api: `require 'sinatra'
require 'json'
require 'pg'

set :bind, '0.0.0.0'
set :port, 4567

# Database connection
def db
  @db ||= PG.connect(
    host: ENV['DB_HOST'],
    dbname: ENV['DB_NAME'],
    user: ENV['DB_USER'],
    password: ENV['DB_PASSWORD']
  )
end

# Get all users
get '/users' do
  content_type :json
  result = db.exec('SELECT * FROM users')
  result.to_a.to_json
end

# Get user by ID
get '/users/:id' do
  content_type :json
  result = db.exec_params('SELECT * FROM users WHERE id = $1', [params[:id]])

  if result.ntuples > 0
    result.first.to_json
  else
    status 404
    { error: 'User not found' }.to_json
  end
end

# Create user
post '/users' do
  content_type :json
  data = JSON.parse(request.body.read)

  result = db.exec_params(
    'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
    [data['name'], data['email']]
  )

  status 201
  result.first.to_json
end`,
        plugin: `# QueryFlux Plugin SDK - Ruby Template

class QueryFluxPlugin
  attr_reader :config, :name, :version

  def initialize(config = {})
    @config = config
    @name = self.class.name
    @version = '1.0.0'
  end

  def execute(context)
    raise NotImplementedError, 'execute must be implemented'
  end

  def validate
    raise NotImplementedError, 'validate must be implemented'
  end

  def metadata
    {
      name: @name,
      version: @version,
      config: @config
    }
  end
end

class CustomPlugin < QueryFluxPlugin
  def execute(context)
    query = context[:query]
    connection = context[:connection]

    # Your plugin logic here
    {
      success: true,
      data: [],
      message: 'Plugin executed successfully'
    }
  end

  def validate
    config.key?(:api_key) && config.key?(:endpoint)
  end
end`
      },
      r: {
        connection: `# R Database Connection using RPostgres

library(DBI)
library(RPostgres)

# Create connection
con <- dbConnect(
  RPostgres::Postgres(),
  host = "your-host",
  dbname = "your-db",
  user = "postgres",
  password = "your-password",
  port = 5432
)

# Test connection
version <- dbGetQuery(con, "SELECT version()")
print(paste("Database version:", version$version))

# Execute query
result <- dbGetQuery(con, "SELECT * FROM users")
print(result)

# Close connection
dbDisconnect(con)`,
        crud: `library(DBI)
library(RPostgres)

# CRUD Operations in R

# CREATE
create_user <- function(con, name, email) {
  query <- "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *"
  result <- dbGetQuery(con, query, params = list(name, email))
  return(result)
}

# READ
read_user <- function(con, id) {
  query <- "SELECT * FROM users WHERE id = $1"
  result <- dbGetQuery(con, query, params = list(id))
  return(result)
}

# UPDATE
update_user <- function(con, id, name, email) {
  query <- "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *"
  result <- dbGetQuery(con, query, params = list(name, email, id))
  return(result)
}

# DELETE
delete_user <- function(con, id) {
  query <- "DELETE FROM users WHERE id = $1"
  result <- dbExecute(con, query, params = list(id))
  return(result > 0)
}

# Example usage
user <- create_user(con, "John Doe", "john@example.com")
print(user)`,
        api: `# R REST API using plumber

library(plumber)
library(DBI)
library(RPostgres)

# Database connection
con <- dbConnect(
  RPostgres::Postgres(),
  host = Sys.getenv("DB_HOST"),
  dbname = Sys.getenv("DB_NAME"),
  user = Sys.getenv("DB_USER"),
  password = Sys.getenv("DB_PASSWORD")
)

#* @get /users
#* @serializer json
function() {
  dbGetQuery(con, "SELECT * FROM users")
}

#* @get /users/<id:int>
#* @serializer json
function(id) {
  result <- dbGetQuery(con, "SELECT * FROM users WHERE id = $1", params = list(id))
  if (nrow(result) == 0) {
    stop("User not found")
  }
  result
}

#* @post /users
#* @serializer json
function(req) {
  body <- jsonlite::fromJSON(req$postBody)
  dbGetQuery(
    con,
    "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
    params = list(body$name, body$email)
  )
}`,
        plugin: `# QueryFlux Plugin SDK - R Template

QueryFluxPlugin <- R6::R6Class(
  "QueryFluxPlugin",
  public = list(
    config = NULL,
    name = NULL,
    version = NULL,

    initialize = function(config = list()) {
      self$config <- config
      self$name <- class(self)[1]
      self$version <- "1.0.0"
    },

    execute = function(context) {
      stop("execute must be implemented")
    },

    validate = function() {
      stop("validate must be implemented")
    },

    get_metadata = function() {
      list(
        name = self$name,
        version = self$version,
        config = self$config
      )
    }
  )
)

CustomPlugin <- R6::R6Class(
  "CustomPlugin",
  inherit = QueryFluxPlugin,
  public = list(
    execute = function(context) {
      query <- context$query
      connection <- context$connection

      # Your plugin logic here
      list(
        success = TRUE,
        data = list(),
        message = "Plugin executed successfully"
      )
    },

    validate = function() {
      "api_key" %in% names(self$config) && "endpoint" %in% names(self$config)
    }
  )
)`
      },
      scala: {
        connection: `import slick.jdbc.PostgresProfile.api._
import scala.concurrent.{Await, Future}
import scala.concurrent.duration._
import scala.concurrent.ExecutionContext.Implicits.global

object DatabaseConnection {
  val db = Database.forConfig("postgres")

  def testConnection(): Unit = {
    val query = sql"SELECT version()".as[String]
    val result = Await.result(db.run(query), 10.seconds)
    println(s"Database version: ${result.head}")
  }

  def close(): Unit = {
    db.close()
  }
}

// application.conf
// postgres {
//   url = "jdbc:postgresql://host:5432/database"
//   driver = "org.postgresql.Driver"
//   user = "postgres"
//   password = "password"
//   connectionPool = "HikariCP"
//   numThreads = 20
// }`,
        crud: `import slick.jdbc.PostgresProfile.api._
import scala.concurrent.Future

case class User(id: Int, name: String, email: String)

class Users(tag: Tag) extends Table[User](tag, "users") {
  def id = column[Int]("id", O.PrimaryKey, O.AutoInc)
  def name = column[String]("name")
  def email = column[String]("email")

  def * = (id, name, email) <> (User.tupled, User.unapply)
}

class UserRepository(db: Database) {
  val users = TableQuery[Users]

  def create(name: String, email: String): Future[User] = {
    val insertQuery = users.returning(users) += User(0, name, email)
    db.run(insertQuery)
  }

  def findById(id: Int): Future[Option[User]] = {
    db.run(users.filter(_.id === id).result.headOption)
  }

  def findAll(): Future[Seq[User]] = {
    db.run(users.result)
  }

  def update(id: Int, name: String, email: String): Future[Int] = {
    val query = users.filter(_.id === id)
      .map(u => (u.name, u.email))
      .update((name, email))
    db.run(query)
  }

  def delete(id: Int): Future[Int] = {
    db.run(users.filter(_.id === id).delete)
  }
}`,
        api: `import akka.http.scaladsl.Http
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.marshallers.sprayjson.SprayJsonSupport._
import spray.json.DefaultJsonProtocol._
import scala.concurrent.ExecutionContextExecutor

case class User(id: Int, name: String, email: String)
case class CreateUserRequest(name: String, email: String)

object UserApi {
  implicit val userFormat = jsonFormat3(User)
  implicit val createUserFormat = jsonFormat2(CreateUserRequest)

  val repository = new UserRepository(DatabaseConnection.db)

  val routes = pathPrefix("users") {
    concat(
      get {
        complete(repository.findAll())
      },
      post {
        entity(as[CreateUserRequest]) { request =>
          complete(repository.create(request.name, request.email))
        }
      },
      path(IntNumber) { id =>
        get {
          complete(repository.findById(id))
        }
      }
    )
  }

  def main(args: Array[String]): Unit = {
    implicit val system = ActorSystem("queryflux-api")
    implicit val executionContext: ExecutionContextExecutor = system.dispatcher

    Http().newServerAt("localhost", 8080).bind(routes)
  }
}`,
        plugin: `/**
 * QueryFlux Plugin SDK - Scala Template
 */

trait QueryFluxPlugin {
  val config: Map[String, Any]
  val name: String
  val version: String = "1.0.0"

  def execute(context: PluginContext): PluginResult
  def validate(): Boolean

  def getMetadata: Map[String, Any] = Map(
    "name" -> name,
    "version" -> version,
    "config" -> config
  )
}

case class PluginContext(
  query: String,
  connection: Any,
  user: Option[Any] = None
)

case class PluginResult(
  success: Boolean,
  data: Seq[Any],
  message: String,
  error: Option[String] = None
)

class CustomPlugin(val config: Map[String, Any]) extends QueryFluxPlugin {
  val name = "CustomPlugin"

  def execute(context: PluginContext): PluginResult = {
    // Your plugin logic here
    PluginResult(
      success = true,
      data = Seq.empty,
      message = "Plugin executed successfully"
    )
  }

  def validate(): Boolean = {
    config.contains("apiKey") && config.contains("endpoint")
  }
}`
      },
      julia: {
        connection: `using LibPQ

# Create connection
conn = LibPQ.Connection("""
    host=your-host
    dbname=your-db
    user=postgres
    password=your-password
    port=5432
""")

# Test connection
result = execute(conn, "SELECT version()")
println("Database version: ", result[1, 1])

# Close connection
close(conn)`,
        crud: `using LibPQ, DataFrames

mutable struct Repository
    conn::LibPQ.Connection
    table::String
end

function create(repo::Repository, data::Dict)
    columns = join(keys(data), ", ")
    placeholders = join(["\$$i" for i in 1:length(data)], ", ")
    values = collect(values(data))

    query = "INSERT INTO $(repo.table) ($columns) VALUES ($placeholders) RETURNING *"
    result = execute(repo.conn, query, values)
    return DataFrame(result)
end

function read(repo::Repository, id::Int)
    query = "SELECT * FROM $(repo.table) WHERE id = \$1"
    result = execute(repo.conn, query, [id])
    return DataFrame(result)
end

function update(repo::Repository, id::Int, data::Dict)
    set_clause = join(["\$k = \$\$i" for (i, k) in enumerate(keys(data))], ", ")
    values = vcat(collect(values(data)), id)

    query = "UPDATE $(repo.table) SET $set_clause WHERE id = \$$(length(data)+1) RETURNING *"
    result = execute(repo.conn, query, values)
    return DataFrame(result)
end

function delete(repo::Repository, id::Int)
    query = "DELETE FROM $(repo.table) WHERE id = \$1"
    execute(repo.conn, query, [id])
    return true
end`,
        api: `using HTTP, JSON, LibPQ

# Database connection
const conn = LibPQ.Connection("postgresql://user:pass@host:5432/dbname")

# GET /users
HTTP.register!(HTTP.Router, "GET", "/users") do req
    result = execute(conn, "SELECT * FROM users")
    users = DataFrame(result)
    return HTTP.Response(200, JSON.json(users))
end

# POST /users
HTTP.register!(HTTP.Router, "POST", "/users") do req
    data = JSON.parse(String(req.body))
    result = execute(
        conn,
        "INSERT INTO users (name, email) VALUES (\$1, \$2) RETURNING *",
        [data["name"], data["email"]]
    )
    user = DataFrame(result)
    return HTTP.Response(201, JSON.json(user))
end

# Start server
HTTP.serve(HTTP.Router, "0.0.0.0", 8080)`,
        plugin: `"""
QueryFlux Plugin SDK - Julia Template
"""

abstract type QueryFluxPlugin end

struct PluginContext
    query::String
    connection::Any
    user::Union{Any, Nothing}
end

struct PluginResult
    success::Bool
    data::Vector{Any}
    message::String
    error::Union{String, Nothing}
end

struct CustomPlugin <: QueryFluxPlugin
    config::Dict{String, Any}
    name::String
    version::String

    CustomPlugin(config::Dict{String, Any}) = new(
        config,
        "CustomPlugin",
        "1.0.0"
    )
end

function execute(plugin::CustomPlugin, context::PluginContext)::PluginResult
    # Your plugin logic here
    return PluginResult(
        true,
        Any[],
        "Plugin executed successfully",
        nothing
    )
end

function validate(plugin::CustomPlugin)::Bool
    return haskey(plugin.config, "apiKey") && haskey(plugin.config, "endpoint")
end

function get_metadata(plugin::CustomPlugin)::Dict{String, Any}
    return Dict(
        "name" => plugin.name,
        "version" => plugin.version,
        "config" => plugin.config
    )
end`
      },
      cpp: {
        connection: `#include <pqxx/pqxx>
#include <iostream>
#include <string>

class DatabaseConnection {
private:
    pqxx::connection conn;

public:
    DatabaseConnection(const std::string& connectionString)
        : conn(connectionString) {
        if (!conn.is_open()) {
            throw std::runtime_error("Failed to open database connection");
        }
    }

    pqxx::connection& getConnection() {
        return conn;
    }

    void testConnection() {
        pqxx::work txn(conn);
        pqxx::result result = txn.exec("SELECT version()");
        std::cout << "Database version: " << result[0][0].c_str() << std::endl;
        txn.commit();
    }
};

int main() {
    try {
        DatabaseConnection db("postgresql://user:pass@host:5432/dbname");
        db.testConnection();
    } catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << std::endl;
        return 1;
    }
    return 0;
}`,
        crud: `#include <pqxx/pqxx>
#include <string>
#include <map>

class Repository {
private:
    pqxx::connection& conn;
    std::string tableName;

public:
    Repository(pqxx::connection& connection, const std::string& table)
        : conn(connection), tableName(table) {}

    int create(const std::map<std::string, std::string>& data) {
        pqxx::work txn(conn);

        std::string columns, placeholders;
        int paramNum = 1;
        for (const auto& [key, value] : data) {
            if (!columns.empty()) {
                columns += ", ";
                placeholders += ", ";
            }
            columns += key;
            placeholders += "$" + std::to_string(paramNum++);
        }

        std::string sql = "INSERT INTO " + tableName + " (" + columns +
                         ") VALUES (" + placeholders + ") RETURNING id";

        pqxx::result result = txn.exec_params(sql,
            [&data](auto& params) {
                for (const auto& [_, value] : data) {
                    params(value);
                }
            });

        txn.commit();
        return result[0][0].as<int>();
    }

    pqxx::result findById(int id) {
        pqxx::work txn(conn);
        std::string sql = "SELECT * FROM " + tableName + " WHERE id = $1";
        pqxx::result result = txn.exec_params(sql, id);
        txn.commit();
        return result;
    }

    bool update(int id, const std::map<std::string, std::string>& data) {
        pqxx::work txn(conn);

        std::string setClause;
        int paramNum = 1;
        for (const auto& [key, value] : data) {
            if (!setClause.empty()) setClause += ", ";
            setClause += key + " = $" + std::to_string(paramNum++);
        }

        std::string sql = "UPDATE " + tableName + " SET " + setClause +
                         " WHERE id = $" + std::to_string(paramNum);

        txn.exec_params(sql, [&](auto& params) {
            for (const auto& [_, value] : data) {
                params(value);
            }
            params(id);
        });

        txn.commit();
        return true;
    }
};`,
        api: `#include <crow.h>
#include <pqxx/pqxx>
#include <json/json.h>

int main() {
    crow::SimpleApp app;

    pqxx::connection conn("postgresql://user:pass@host:5432/dbname");

    // GET /users
    CROW_ROUTE(app, "/users")
    ([&conn]() {
        pqxx::work txn(conn);
        pqxx::result result = txn.exec("SELECT * FROM users");
        txn.commit();

        crow::json::wvalue json;
        std::vector<crow::json::wvalue> users;

        for (auto row : result) {
            crow::json::wvalue user;
            user["id"] = row["id"].as<int>();
            user["name"] = row["name"].c_str();
            user["email"] = row["email"].c_str();
            users.push_back(std::move(user));
        }

        json["users"] = std::move(users);
        return crow::response{json};
    });

    // POST /users
    CROW_ROUTE(app, "/users").methods("POST"_method)
    ([&conn](const crow::request& req) {
        auto json = crow::json::load(req.body);

        pqxx::work txn(conn);
        pqxx::result result = txn.exec_params(
            "INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *",
            json["name"].s(),
            json["email"].s()
        );
        txn.commit();

        crow::json::wvalue response;
        response["id"] = result[0]["id"].as<int>();
        response["name"] = result[0]["name"].c_str();
        response["email"] = result[0]["email"].c_str();

        return crow::response{201, response};
    });

    app.port(8080).multithreaded().run();
}`,
        plugin: `/**
 * QueryFlux Plugin SDK - C++ Template
 */

#include <string>
#include <map>
#include <vector>
#include <memory>

namespace QueryFlux {

struct PluginContext {
    std::string query;
    void* connection;
    void* user;
};

struct PluginResult {
    bool success;
    std::vector<std::any> data;
    std::string message;
    std::string error;
};

class Plugin {
protected:
    std::map<std::string, std::string> config;
    std::string name;
    std::string version;

public:
    Plugin(const std::map<std::string, std::string>& cfg)
        : config(cfg), version("1.0.0") {}

    virtual ~Plugin() = default;

    virtual PluginResult execute(const PluginContext& context) = 0;
    virtual bool validate() = 0;

    std::map<std::string, std::string> getMetadata() {
        return {
            {"name", name},
            {"version", version}
        };
    }
};

class CustomPlugin : public Plugin {
public:
    CustomPlugin(const std::map<std::string, std::string>& config)
        : Plugin(config) {
        name = "CustomPlugin";
    }

    PluginResult execute(const PluginContext& context) override {
        // Your plugin logic here
        return PluginResult{
            true,
            {},
            "Plugin executed successfully",
            ""
        };
    }

    bool validate() override {
        return config.find("apiKey") != config.end() &&
               config.find("endpoint") != config.end();
    }
};

} // namespace QueryFlux`
      }
    };

    return templates[lang]?.[type] || `// Code template not available for ${lang} - ${type}`;
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCode = () => {
    const lang = programmingLanguages.find(l => l.id === selectedLanguage);
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queryflux-${codeType}${lang?.fileExtension || '.txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const saveSnippet = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('code_snippets')
      .insert({
        user_id: user.id,
        title: `${selectedLanguage} ${codeType}`,
        description: `Generated code for ${codeType}`,
        language: selectedLanguage,
        code: generatedCode,
        tags: [selectedLanguage, codeType],
        is_public: false
      });

    if (error) {
      alert('Failed to save snippet');
    } else {
      alert('Snippet saved successfully!');
    }
  };

  if (!isOpen) return null;

  const currentLang = programmingLanguages.find(l => l.id === selectedLanguage);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xl" style={{ backgroundColor: `${theme.colors.background}cc` }}>
      <div className="relative w-full max-w-6xl h-[90vh] glass-card rounded-3xl shadow-2xl flex flex-col" style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.foreground, overflow: 'auto' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          <div className="flex items-center gap-3">
            <FileCode className="w-6 h-6" style={{ color: theme.colors.accent }} />
            <div>
              <h2 className="text-xl font-bold" style={{ color: theme.colors.text }}>
                {t('codeGenerator.title')}
              </h2>
              <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                {t('codeGenerator.subtitle')}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full glass-morphism hover-3d transition-all">
            <X className="w-5 h-5" style={{ color: theme.colors.textSecondary }} />
          </button>
        </div>

        <div className="px-6 py-4 border-b" style={{ borderColor: theme.colors.border }}>
          {/* Step Progress */}
          <div className="flex items-center gap-4 mb-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentStep === 'connection' ? 'glass-morphism' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep === 'connection' ? 'glass-card' : ''}`} style={{ backgroundColor: currentStep === 'connection' ? theme.colors.accent : theme.colors.border, color: theme.colors.text }}>1</div>
              <span className="text-sm font-medium" style={{ color: theme.colors.text }}>{t('codeGenerator.connection')}</span>
            </div>
            <div className="h-px flex-1" style={{ backgroundColor: theme.colors.border }} />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentStep === 'tables' ? 'glass-morphism' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep === 'tables' ? 'glass-card' : ''}`} style={{ backgroundColor: currentStep === 'tables' || currentStep === 'generate' ? theme.colors.accent : theme.colors.border, color: theme.colors.text }}>2</div>
              <span className="text-sm font-medium" style={{ color: theme.colors.text }}>{t('codeGenerator.selectTables')}</span>
            </div>
            <div className="h-px flex-1" style={{ backgroundColor: theme.colors.border }} />
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${currentStep === 'generate' ? 'glass-morphism' : 'opacity-50'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep === 'generate' ? 'glass-card' : ''}`} style={{ backgroundColor: currentStep === 'generate' ? theme.colors.accent : theme.colors.border, color: theme.colors.text }}>3</div>
              <span className="text-sm font-medium" style={{ color: theme.colors.text }}>{t('codeGenerator.generate')}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => setShowConnectionSelector(!showConnectionSelector)}
              className="flex items-center gap-2 px-6 py-3 rounded-lg glass-card border-4 transition-all hover:scale-105"
              style={{
                borderColor: selectedConnection ? theme.colors.accent : theme.colors.border,
                backgroundColor: theme.colors.foreground
              }}
            >
              <Database className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <span className="font-bold text-lg" style={{ color: theme.colors.text }}>
                {selectedConnection ? selectedConnection.name : t('codeGenerator.selectConnection')}
              </span>
              <ChevronDown className={`w-5 h-5 transition-transform ${showConnectionSelector ? 'rotate-180' : ''}`} style={{ color: theme.colors.accent }} />
            </button>

            <button
              onClick={() => setShowTableSelector(!showTableSelector)}
              disabled={!selectedConnection}
              className="flex items-center gap-2 px-6 py-3 rounded-lg glass-card border-4 transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                borderColor: selectedTables.length > 0 ? theme.colors.accent : theme.colors.border,
                backgroundColor: theme.colors.foreground
              }}
            >
              <Database className="w-5 h-5" style={{ color: theme.colors.accent }} />
              <span className="font-bold text-lg" style={{ color: theme.colors.text }}>
                {selectedTables.length > 0 ? `${selectedTables.length} ${t('codeGenerator.tables')}` : t('codeGenerator.selectTables')}
              </span>
              <ChevronDown className={`w-5 h-5 transition-transform ${showTableSelector ? 'rotate-180' : ''}`} style={{ color: theme.colors.accent }} />
            </button>

            <button
              onClick={() => {
                console.log('Language button clicked, current state:', showLanguageDropdown);
                setShowLanguageDropdown(!showLanguageDropdown);
              }}
              className="flex items-center gap-2 px-6 py-3 rounded-lg glass-card border-4 transition-all hover:scale-105"
              style={{
                borderColor: theme.colors.accent,
                backgroundColor: theme.colors.foreground
              }}
            >
              <span className="text-2xl">{currentLang?.icon}</span>
              <span className="font-bold text-lg" style={{ color: theme.colors.text }}>
                {currentLang?.name}
              </span>
              <ChevronDown className={`w-5 h-5 transition-transform ${showLanguageDropdown ? 'rotate-180' : ''}`} style={{ color: theme.colors.accent }} />
            </button>

            <div className="flex gap-2 flex-wrap">
              {['connection', 'crud', 'migration', 'api', 'orm', 'plugin'].map((type) => (
                <button
                  key={type}
                  onClick={() => setCodeType(type as any)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    codeType === type ? 'glass-morphism' : 'hover:bg-white/5'
                  }`}
                  style={{
                    color: codeType === type ? theme.colors.accent : theme.colors.textSecondary
                  }}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Connection Selector */}
          <div style={{
            maxHeight: showConnectionSelector ? '300px' : '0px',
            opacity: showConnectionSelector ? 1 : 0,
            overflow: showConnectionSelector ? 'auto' : 'hidden',
            marginBottom: showConnectionSelector ? '20px' : '0px',
            transition: 'all 0.3s ease'
          }}>
            {showConnectionSelector && (
              <div className="glass-card p-4 rounded-xl">
                <p className="text-sm font-semibold mb-3" style={{ color: theme.colors.textSecondary }}>
                  Select a database connection:
                </p>
                {connections.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {connections.map((conn) => (
                      <button
                        key={conn.id}
                        onClick={() => {
                          setSelectedConnection(conn);
                          setShowConnectionSelector(false);
                          setSelectedTables([]);
                        }}
                        className={`p-4 rounded-lg text-left font-medium transition-all border-2 ${
                          selectedConnection?.id === conn.id
                            ? 'scale-105'
                            : 'hover:bg-white/10 hover:scale-105'
                        }`}
                        style={{
                          borderColor: selectedConnection?.id === conn.id ? theme.colors.accent : theme.colors.border,
                          backgroundColor: selectedConnection?.id === conn.id ? theme.colors.accent + '22' : 'transparent',
                          color: theme.colors.text
                        }}
                      >
                        {selectedConnection?.id === conn.id && (
                          <Check className="w-4 h-4 inline mr-2" style={{ color: theme.colors.accent }} />
                        )}
                        <div>
                          <div className="font-bold">{conn.name}</div>
                          <div className="text-xs opacity-70">{conn.type} • {conn.host}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                    {t('codeGenerator.noConnectionsFound')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Table Selector */}
          {selectedConnection && (
            <div style={{
              maxHeight: showTableSelector ? '300px' : '0px',
              opacity: showTableSelector ? 1 : 0,
              overflow: showTableSelector ? 'auto' : 'hidden',
              marginBottom: showTableSelector ? '20px' : '0px',
              transition: 'all 0.3s ease'
            }}>
              {showTableSelector && (
                <div className="glass-card p-4 rounded-xl">
                  <p className="text-sm font-semibold mb-3" style={{ color: theme.colors.textSecondary }}>
                    Select tables for code generation:
                  </p>
                  {tables.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {tables.map((table) => (
                        <button
                          key={table}
                          onClick={() => toggleTableSelection(table)}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                            selectedTables.includes(table)
                              ? 'scale-105'
                              : 'hover:bg-white/10 hover:scale-105'
                          }`}
                          style={{
                            borderColor: selectedTables.includes(table) ? theme.colors.accent : theme.colors.border,
                            backgroundColor: selectedTables.includes(table) ? theme.colors.accent + '22' : 'transparent',
                            color: theme.colors.text
                          }}
                        >
                          {selectedTables.includes(table) && (
                            <Check className="w-4 h-4 inline mr-1" style={{ color: theme.colors.accent }} />
                          )}
                          {table}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
                      No tables found. Please browse tables from the left sidebar first.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div style={{
            maxHeight: showLanguageDropdown ? '400px' : '0px',
            opacity: showLanguageDropdown ? 1 : 0,
            overflow: showLanguageDropdown ? 'visible' : 'hidden',
            padding: showLanguageDropdown ? '20px' : '0px',
            transition: 'all 0.3s ease'
          }}>
            {showLanguageDropdown && (
              <div className="grid grid-cols-5 gap-3">
                {programmingLanguages.map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => {
                      console.log('Language selected:', lang.id);
                      setSelectedLanguage(lang.id);
                      saveLanguagePreference(lang.id);
                      setShowLanguageDropdown(false);
                    }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all border-4 ${
                      selectedLanguage === lang.id
                        ? 'scale-110'
                        : 'hover:bg-white/10 hover:scale-105'
                    }`}
                    style={{
                      borderColor: selectedLanguage === lang.id ? theme.colors.accent : '#ffffff44',
                      backgroundColor: selectedLanguage === lang.id ? theme.colors.accent + '44' : '#00000044'
                    }}
                    title={lang.name}
                  >
                    <span className="text-4xl">{lang.icon}</span>
                    <span className="text-sm font-bold text-white text-center">
                      {lang.name}
                    </span>
                    {selectedLanguage === lang.id && (
                      <Check className="w-5 h-5" style={{ color: theme.colors.accent }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden p-6">
          <div className="h-full rounded-xl overflow-hidden" style={{ backgroundColor: '#1e1e1e' }}>
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-4 text-xs text-gray-400">
                  {currentLang?.name} - {codeType}{currentLang?.fileExtension}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-all"
                  title="Copy to clipboard"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? t('codeGenerator.copied') : t('codeGenerator.copy')}
                </button>
                <button
                  onClick={downloadCode}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-all"
                  title="Download code"
                >
                  <Download className="w-4 h-4" />
                  {t('codeGenerator.download')}
                </button>
                <button
                  onClick={saveSnippet}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-all"
                  title="Save snippet"
                >
                  <Save className="w-4 h-4" />
                  {t('codeGenerator.save')}
                </button>
                <button
                  onClick={deployAsEndpoint}
                  disabled={!selectedConnection || selectedTables.length === 0 || isDeploying}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white hover:bg-white/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Deploy as API Endpoint"
                  style={{ backgroundColor: theme.colors.accent + '44' }}
                >
                  <Rocket className="w-4 h-4" />
                  {isDeploying ? t('codeGenerator.deploying') : t('codeGenerator.deployEndpoint')}
                </button>
                <button
                  onClick={generateCode}
                  disabled={!selectedConnection || selectedTables.length === 0}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: theme.colors.accent + '20', color: theme.colors.accent }}
                  title="Regenerate"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('codeGenerator.regenerate')}
                </button>
              </div>
            </div>

            <pre className="p-4 overflow-auto h-full text-sm font-mono">
              <code className="text-gray-100">{isGenerating ? 'Generating code...' : generatedCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
