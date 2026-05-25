/**
 * Database Test Component
 *
 * A testing component for validating PostgreSQL database connections
 * and query execution using the new database adapters.
 */

import { useState } from 'react';
import { Database, Play, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { databaseService } from '../lib/database/databaseService';
import { PostgresAdapter } from '../lib/database/adapters/postgresAdapter';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface TestResult {
  success: boolean;
  message: string;
  data?: any;
  executionTime?: number;
}

export function DatabaseTest() {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [testConfig, setTestConfig] = useState({
    host: 'localhost',
    port: '5432',
    database: 'postgres',
    user: 'postgres',
    password: '',
    ssl: false,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [isQuerying, setIsQuerying] = useState(false);
  const [testQuery, setTestQuery] = useState('SELECT version(), current_database(), current_user;');
  const [queryResult, setQueryResult] = useState<TestResult | null>(null);
  const [connectionResult, setConnectionResult] = useState<TestResult | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleTestConnection = async () => {
    setIsConnecting(true);
    setConnectionResult(null);

    try {
      const startTime = Date.now();

      const testConnection = {
        dbType: 'postgresql' as const,
        name: 'Test Connection',
        connectionConfig: {
          host: testConfig.host,
          port: parseInt(testConfig.port),
          database: testConfig.database,
          user: testConfig.user,
          password: testConfig.password,
          ssl: testConfig.ssl,
        },
      };

      const result = await databaseService.testConnection(testConnection);
      const latency = Date.now() - startTime;

      setConnectionResult({
        success: result.success,
        message: result.message + (result.latency ? ` (${result.latency}ms)` : ` (${latency}ms)`),
      });

      setIsConnected(result.success);
    } catch (error) {
      setConnectionResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      });
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleTestQuery = async () => {
    if (!isConnected) {
      setQueryResult({
        success: false,
        message: 'Please connect to database first',
      });
      return;
    }

    setIsQuerying(true);
    setQueryResult(null);

    try {
      // Create a temporary adapter for this test
      const adapter = new PostgresAdapter({
        host: testConfig.host,
        port: parseInt(testConfig.port),
        database: testConfig.database,
        user: testConfig.user,
        password: testConfig.password,
        ssl: testConfig.ssl,
      });

      await adapter.connect();

      const result = await adapter.executeQuery(testQuery);

      setQueryResult({
        success: result.success,
        message: result.message,
        data: result.data,
        executionTime: result.executionTime,
      });

      await adapter.disconnect();
    } catch (error) {
      setQueryResult({
        success: false,
        message: error instanceof Error ? error.message : 'Query execution failed',
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const handleGetSchema = async () => {
    if (!isConnected) {
      setQueryResult({
        success: false,
        message: 'Please connect to database first',
      });
      return;
    }

    setIsQuerying(true);
    setQueryResult(null);

    try {
      const adapter = new PostgresAdapter({
        host: testConfig.host,
        port: parseInt(testConfig.port),
        database: testConfig.database,
        user: testConfig.user,
        password: testConfig.password,
        ssl: testConfig.ssl,
      });

      await adapter.connect();

      const schema = await adapter.getSchema();

      setQueryResult({
        success: true,
        message: `Schema retrieved successfully. Found ${schema.tables.length} tables and ${schema.views.length} views.`,
        data: {
          databaseName: schema.databaseName,
          version: schema.version,
          tables: schema.tables.map(t => ({
            name: t.name,
            type: t.type,
            columns: t.columns.length,
            rowCount: t.rowCount,
          })),
        },
        executionTime: 0,
      });

      await adapter.disconnect();
    } catch (error) {
      setQueryResult({
        success: false,
        message: error instanceof Error ? error.message : 'Schema retrieval failed',
      });
    } finally {
      setIsQuerying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center glow-effect"
          style={{ backgroundColor: theme.colors.accent + '20' }}>
          <Database className="w-6 h-6" style={{ color: theme.colors.accent }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: theme.colors.text }}>
            PostgreSQL Database Test
          </h1>
          <p className="text-sm" style={{ color: theme.colors.textSecondary }}>
            Test real PostgreSQL connections using the new database adapter
          </p>
        </div>
      </div>

      {/* Connection Configuration */}
      <div className="p-6 rounded-2xl glass-card border" style={{ borderColor: theme.colors.border }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: theme.colors.text }}>
          Database Connection
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
              Host
            </label>
            <input
              type="text"
              value={testConfig.host}
              onChange={(e) => setTestConfig(prev => ({ ...prev, host: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg glass-morphism text-sm"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`
              }}
              placeholder="localhost"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
              Port
            </label>
            <input
              type="text"
              value={testConfig.port}
              onChange={(e) => setTestConfig(prev => ({ ...prev, port: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg glass-morphism text-sm"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`
              }}
              placeholder="5432"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
              Database
            </label>
            <input
              type="text"
              value={testConfig.database}
              onChange={(e) => setTestConfig(prev => ({ ...prev, database: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg glass-morphism text-sm"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`
              }}
              placeholder="postgres"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
              Username
            </label>
            <input
              type="text"
              value={testConfig.user}
              onChange={(e) => setTestConfig(prev => ({ ...prev, user: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg glass-morphism text-sm"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`
              }}
              placeholder="postgres"
            />
          </div>

          <div className="col-span-2">
            <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
              Password
            </label>
            <input
              type="password"
              value={testConfig.password}
              onChange={(e) => setTestConfig(prev => ({ ...prev, password: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg glass-morphism text-sm"
              style={{
                backgroundColor: theme.colors.background,
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`
              }}
              placeholder="Enter password..."
            />
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4">
          <label className="flex items-center gap-2 text-sm" style={{ color: theme.colors.text }}>
            <input
              type="checkbox"
              checked={testConfig.ssl}
              onChange={(e) => setTestConfig(prev => ({ ...prev, ssl: e.target.checked }))}
              className="rounded"
            />
            Use SSL/TLS
          </label>
        </div>

        <button
          onClick={handleTestConnection}
          disabled={isConnecting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg glass-morphism hover-3d transition-all disabled:opacity-50"
          style={{ color: theme.colors.text }}
        >
          {isConnecting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Test Connection
        </button>

        {connectionResult && (
          <div className={`mt-4 p-3 rounded-lg flex items-start gap-2 ${
            connectionResult.success
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            {connectionResult.success ? (
              <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
            )}
            <span className={`text-sm ${
              connectionResult.success ? 'text-green-300' : 'text-red-300'
            }`}>
              {connectionResult.message}
            </span>
          </div>
        )}
      </div>

      {/* Query Testing */}
      <div className="p-6 rounded-2xl glass-card border" style={{ borderColor: theme.colors.border }}>
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: theme.colors.text }}>
          Query Testing
        </h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: theme.colors.textSecondary }}>
            Test Query
          </label>
          <textarea
            value={testQuery}
            onChange={(e) => setTestQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-lg glass-morphism text-sm font-mono"
            style={{
              backgroundColor: theme.colors.background,
              color: theme.colors.text,
              border: `1px solid ${theme.colors.border}`,
              minHeight: '100px'
            }}
            placeholder="Enter SQL query..."
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleTestQuery}
            disabled={!isConnected || isQuerying}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg glass-morphism hover-3d transition-all disabled:opacity-50"
            style={{ color: theme.colors.text }}
          >
            {isQuerying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Execute Query
          </button>

          <button
            onClick={handleGetSchema}
            disabled={!isConnected || isQuerying}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg glass-morphism hover-3d transition-all disabled:opacity-50"
            style={{ color: theme.colors.text }}
          >
            {isQuerying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Database className="w-4 h-4" />
            )}
            Get Schema
          </button>
        </div>

        {queryResult && (
          <div className={`mt-4 p-3 rounded-lg ${
            queryResult.success
              ? 'bg-green-500/10 border border-green-500/30'
              : 'bg-red-500/10 border border-red-500/30'
          }`}>
            <div className="flex items-start gap-2 mb-2">
              {queryResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <span className={`text-sm ${
                  queryResult.success ? 'text-green-300' : 'text-red-300'
                }`}>
                  {queryResult.message}
                </span>
                {queryResult.executionTime && (
                  <span className="text-xs text-gray-400 ml-2">
                    ({queryResult.executionTime}ms)
                  </span>
                )}
              </div>
            </div>

            {queryResult.data && (
              <div className="mt-3">
                {Array.isArray(queryResult.data) ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b" style={{ borderColor: theme.colors.border }}>
                          {Object.keys(queryResult.data[0] || {}).map(key => (
                            <th key={key} className="text-left p-2 font-medium" style={{ color: theme.colors.textSecondary }}>
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {queryResult.data.slice(0, 10).map((row, index) => (
                          <tr key={index} className="border-b" style={{ borderColor: theme.colors.border }}>
                            {Object.values(row).map((value, cellIndex) => (
                              <td key={cellIndex} className="p-2" style={{ color: theme.colors.text }}>
                                {String(value)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {queryResult.data.length > 10 && (
                      <p className="text-xs text-gray-400 mt-2">
                        Showing 10 of {queryResult.data.length} rows
                      </p>
                    )}
                  </div>
                ) : (
                  <pre className="text-xs bg-black/30 p-2 rounded overflow-x-auto">
                    {JSON.stringify(queryResult.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 rounded-2xl glass-card border" style={{ borderColor: theme.colors.border }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: theme.colors.text }}>
          Testing Instructions
        </h3>
        <ul className="text-xs space-y-1" style={{ color: theme.colors.textSecondary }}>
          <li>• Configure your PostgreSQL connection details above</li>
          <li>• Click "Test Connection" to verify connectivity</li>
          <li>• Once connected, execute SQL queries or retrieve database schema</li>
          <li>• Results will be displayed below each action</li>
          <li>• This uses the new PostgreSQL adapter with real database connections</li>
        </ul>
      </div>
    </div>
  );
}
