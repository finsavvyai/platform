import React from 'react';

export const DatabaseExplorer: React.FC = () => {
  const mockSchema = {
    postgresql: {
      tables: [
        { name: 'users', columns: ['id', 'username', 'email', 'created_at', 'is_active'] },
        { name: 'connections', columns: ['id', 'user_id', 'name', 'database_type', 'host', 'port'] },
        { name: 'queries', columns: ['id', 'user_id', 'connection_id', 'query_text', 'executed_at'] }
      ]
    },
    mysql: {
      tables: [
        { name: 'users', columns: ['id', 'username', 'email', 'created_at', 'is_active'] },
        { name: 'connections', columns: ['id', 'user_id', 'name', 'database_type', 'host', 'port'] }
      ]
    }
  };

  return (
    <div>
      <h3 style={{ color: '#1e293b', marginBottom: '20px' }}>Database Schema Explorer</h3>
      <p style={{ color: '#64748b', marginBottom: '20px' }}>
        Connect to a database to explore its schema and structure.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              marginRight: '8px'
            }} />
            <h4 style={{ margin: 0, color: '#1e293b' }}>PostgreSQL (Test)</h4>
          </div>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            localhost:5435 • queryflux_test
          </div>
          <div>
            <div style={{ fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Tables:</div>
            {mockSchema.postgresql.tables.map(table => (
              <div key={table.name} style={{ marginBottom: '8px' }}>
                <div style={{ color: '#1e293b', fontSize: '14px' }}>📄 {table.name}</div>
                <div style={{ color: '#64748b', fontSize: '12px', marginLeft: '20px' }}>
                  {table.columns.slice(0, 3).join(', ')}{table.columns.length > 3 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              marginRight: '8px'
            }} />
            <h4 style={{ margin: 0, color: '#1e293b' }}>MySQL (Test)</h4>
          </div>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            localhost:3309 • queryflux_test
          </div>
          <div>
            <div style={{ fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Tables:</div>
            {mockSchema.mysql.tables.map(table => (
              <div key={table.name} style={{ marginBottom: '8px' }}>
                <div style={{ color: '#1e293b', fontSize: '14px' }}>📄 {table.name}</div>
                <div style={{ color: '#64748b', fontSize: '12px', marginLeft: '20px' }}>
                  {table.columns.slice(0, 3).join(', ')}{table.columns.length > 3 ? '...' : ''}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              marginRight: '8px'
            }} />
            <h4 style={{ margin: 0, color: '#1e293b' }}>MongoDB (Test)</h4>
          </div>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            localhost:27019 • queryflux_test
          </div>
          <div>
            <div style={{ fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Collections:</div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#1e293b', fontSize: '14px' }}>📄 users</div>
              <div style={{ color: '#64748b', fontSize: '12px', marginLeft: '20px' }}>
                2 documents
              </div>
            </div>
            <div style={{ marginBottom: '8px' }}>
              <div style={{ color: '#1e293b', fontSize: '14px' }}>📄 connections</div>
              <div style={{ color: '#64748b', fontSize: '12px', marginLeft: '20px' }}>
                2 documents
              </div>
            </div>
          </div>
        </div>

        <div style={{
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '16px',
          backgroundColor: '#f8fafc'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: '#10B981',
              marginRight: '8px'
            }} />
            <h4 style={{ margin: 0, color: '#1e293b' }}>Redis (Test)</h4>
          </div>
          <div style={{ color: '#64748b', fontSize: '14px', marginBottom: '12px' }}>
            localhost:6382
          </div>
          <div>
            <div style={{ fontWeight: '500', color: '#374151', marginBottom: '8px' }}>Status:</div>
            <div style={{ color: '#10B981', fontSize: '14px' }}>🟢 Connected</div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>
              Memory: 1.2MB • Keys: 0
            </div>
          </div>
        </div>
      </div>

      <div style={{
        marginTop: '24px',
        padding: '16px',
        backgroundColor: '#eff6ff',
        border: '1px solid #93c5fd',
        borderRadius: '8px'
      }}>
        <h4 style={{ margin: '0 0 8px 0', color: '#1e3a8a' }}>Available Test Databases</h4>
        <p style={{ margin: 0, color: '#1e3a8a', fontSize: '14px' }}>
          All test databases are running and accessible. Use the Connection form to connect with these pre-configured databases.
        </p>
      </div>
    </div>
  );
};

export default DatabaseExplorer;