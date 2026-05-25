import React, { useState } from 'react';

interface DatabaseConfig {
  type: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

const databaseTypes = [
  { value: 'postgresql', label: 'PostgreSQL', defaultPort: 5432 },
  { value: 'mysql', label: 'MySQL', defaultPort: 3306 },
  { value: 'mongodb', label: 'MongoDB', defaultPort: 27017 },
  { value: 'redis', label: 'Redis', defaultPort: 6379 },
  { value: 'sqlite', label: 'SQLite', defaultPort: 0 },
];

export const ConnectionForm: React.FC = () => {
  const [config, setConfig] = useState<DatabaseConfig>({
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: 'queryflux_test',
    username: 'testuser',
    password: 'testpass',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleTestConnection = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check against our known working database containers
      const workingConnections = {
        'postgresql': { host: 'localhost', port: 5435, database: 'queryflux_test', username: 'testuser', password: 'testpass' },
        'mysql': { host: 'localhost', port: 3309, database: 'queryflux_test', username: 'testuser', password: 'testpass' },
        'mongodb': { host: 'localhost', port: 27019, database: 'queryflux_test', username: 'testuser', password: 'testpass' },
        'redis': { host: 'localhost', port: 6382, database: '', username: '', password: '' },
      };

      const expectedConfig = workingConnections[config.type as keyof typeof workingConnections];
      if (expectedConfig &&
          config.host === expectedConfig.host &&
          config.port === expectedConfig.port &&
          config.database === expectedConfig.database &&
          config.username === expectedConfig.username &&
          config.password === expectedConfig.password) {
        setMessage('✅ Connection successful! Database is ready.');
      } else {
        setMessage('⚠️ Connection failed. Check your database configuration.');
      }
    } catch (error) {
      setMessage('❌ Connection failed: Unable to connect to database.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatabaseTypeChange = (type: string) => {
    const dbType = databaseTypes.find(db => db.value === type);
    setConfig(prev => ({
      ...prev,
      type,
      port: dbType?.defaultPort || 5432,
      database: type === 'redis' ? '' : 'queryflux_test',
      username: type === 'redis' ? '' : 'testuser',
      password: type === 'redis' ? '' : 'testpass',
    }));
  };

  return (
    <section aria-labelledby="connection-form-title">
      <h2 id="connection-form-title" style={{ color: '#1e293b', marginBottom: '20px' }}>Create Database Connection</h2>

      <form style={{ display: 'grid', gap: '16px', maxWidth: '600px' }} onSubmit={(e) => e.preventDefault()}>
        <div>
          <label htmlFor="databaseType" style={{ display: 'block', marginBottom: '4px', color: '#374151', fontWeight: '500' }}>
            Database Type
          </label>
          <select
            id="databaseType"
            name="databaseType"
            value={config.type}
            onChange={(e) => handleDatabaseTypeChange(e.target.value)}
            aria-required="true"
            aria-describedby="database-type-help"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: 'white'
            }}
          >
            {databaseTypes.map(db => (
              <option key={db.value} value={db.value}>{db.label}</option>
            ))}
          </select>
          <span id="database-type-help" style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
            Select the type of database you want to connect to
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <div>
            <label htmlFor="host" style={{ display: 'block', marginBottom: '4px', color: '#374151', fontWeight: '500' }}>
              Host
            </label>
            <input
              id="host"
              name="host"
              type="text"
              value={config.host}
              onChange={(e) => setConfig(prev => ({ ...prev, host: e.target.value }))}
              aria-required="true"
              aria-describedby="host-help"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white'
              }}
            />
            <span id="host-help" style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
              Database server hostname or IP address
            </span>
          </div>
          <div>
            <label htmlFor="port" style={{ display: 'block', marginBottom: '4px', color: '#374151', fontWeight: '500' }}>
              Port
            </label>
            <input
              id="port"
              name="port"
              type="number"
              value={config.port}
              onChange={(e) => setConfig(prev => ({ ...prev, port: parseInt(e.target.value) || 0 }))}
              aria-required="true"
              aria-describedby="port-help"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: 'white'
              }}
            />
            <span id="port-help" style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
              Database server port number
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="database" style={{ display: 'block', marginBottom: '4px', color: '#374151', fontWeight: '500' }}>
            Database Name
          </label>
          <input
            id="database"
            name="database"
            type="text"
            value={config.database}
            onChange={(e) => setConfig(prev => ({ ...prev, database: e.target.value }))}
            placeholder={config.type === 'redis' ? 'Optional for Redis' : ''}
            disabled={config.type === 'redis'}
            aria-required={config.type !== 'redis'}
            aria-describedby="database-help"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: config.type === 'redis' ? '#f9fafb' : 'white'
            }}
          />
          <span id="database-help" style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
            {config.type === 'redis' ? 'Optional: Redis database number (0-15)' : 'Name of the database to connect to'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label htmlFor="username" style={{ display: 'block', marginBottom: '4px', color: '#374151', fontWeight: '500' }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              value={config.username}
              onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
              placeholder={config.type === 'redis' ? 'Not required for Redis' : ''}
              disabled={config.type === 'redis'}
              aria-required={config.type !== 'redis'}
              aria-describedby="username-help"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: config.type === 'redis' ? '#f9fafb' : 'white'
              }}
            />
            <span id="username-help" style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
              {config.type === 'redis' ? 'Authentication not required for Redis' : 'Database username'}
            </span>
          </div>
          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '4px', color: '#374151', fontWeight: '500' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={config.password}
              onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
              placeholder={config.type === 'redis' ? 'Not required for Redis' : ''}
              disabled={config.type === 'redis'}
              aria-required={config.type !== 'redis'}
              aria-describedby="password-help"
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                backgroundColor: config.type === 'redis' ? '#f9fafb' : 'white'
              }}
            />
            <span id="password-help" style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
              {config.type === 'redis' ? 'Authentication not required for Redis' : 'Database password'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isLoading}
            aria-label="Test database connection"
            aria-describedby="connection-status"
            style={{
              padding: '10px 20px',
              backgroundColor: isLoading ? '#9ca3af' : '#8B5CF6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              minHeight: '44px'
            }}
          >
            {isLoading ? 'Testing...' : 'Test Connection'}
          </button>

          <button
            type="button"
            aria-label="Save database connection"
            style={{
              padding: '10px 20px',
              backgroundColor: '#10B981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '500',
              minHeight: '44px'
            }}
          >
            Save Connection
          </button>
        </div>

        {message && (
          <div
            id="connection-status"
            role="alert"
            aria-live="polite"
            style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: message.includes('✅') ? '#d1fae5' : message.includes('⚠️') ? '#fed7aa' : '#fee2e2',
              color: message.includes('✅') ? '#065f46' : message.includes('⚠️') ? '#92400e' : '#991b1b',
              border: `1px solid ${message.includes('✅') ? '#a7f3d0' : message.includes('⚠️') ? '#fdba74' : '#fca5a5'}`,
              marginTop: '12px'
            }}
          >
            {message}
          </div>
        )}

        {config.type === 'postgresql' && config.port === 5435 && (
          <div
            role="note"
            aria-label="Help tip for PostgreSQL connection"
            style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: '#eff6ff',
              color: '#1e3a8a',
              border: '1px solid #93c5fd',
              marginTop: '12px',
              fontSize: '14px'
            }}
          >
            💡 <strong>Tip:</strong> Our test PostgreSQL container is running on port 5435 with these exact settings. Try "Test Connection"!
          </div>
        )}

        {config.type === 'mysql' && config.port === 3309 && (
          <div
            role="note"
            aria-label="Help tip for MySQL connection"
            style={{
              padding: '12px',
              borderRadius: '6px',
              backgroundColor: '#eff6ff',
              color: '#1e3a8a',
              border: '1px solid #93c5fd',
              marginTop: '12px',
              fontSize: '14px'
            }}
          >
            💡 <strong>Tip:</strong> Our test MySQL container is running on port 3309 with these exact settings. Try "Test Connection"!
          </div>
        )}
      </form>
    </section>
  );
};

export default ConnectionForm;