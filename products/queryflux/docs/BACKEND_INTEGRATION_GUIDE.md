# Backend Integration Guide

This guide provides comprehensive instructions for integrating the QueryFlux frontend components with the Go backend API.

## Overview

QueryFlux has been transformed from a frontend-only application into a complete ecosystem with:
- **Go Backend**: High-performance REST API with real database drivers
- **Electron Desktop**: Native apps with full backend integration
- **Mobile App**: Real-time monitoring and alerts
- **Marketing Website**: Integrated payments and user management

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Electron      │    │   Mobile App    │    │   Website       │
│   Desktop App   │    │  (React Native) │    │  (Next.js)      │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Go Backend    │
                    │   (REST API)    │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Databases     │
                    │ (PostgreSQL,    │
                    │ MySQL, MongoDB) │
                    └─────────────────┘
```

## Backend API Endpoints

### Authentication
```
POST   /api/v1/auth/login
POST   /api/v1/auth/register
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
GET    /api/v1/auth/me
```

### Database Connections
```
GET    /api/v1/connections
POST   /api/v1/connections
GET    /api/v1/connections/{id}
PATCH  /api/v1/connections/{id}
DELETE /api/v1/connections/{id}
POST   /api/v1/connections/test
GET    /api/v1/connections/{id}/schema
```

### Query Operations
```
POST   /api/v1/queries/execute
GET    /api/v1/queries/history
POST   /api/v1/queries/saved
GET    /api/v1/queries/saved
DELETE /api/v1/queries/saved/{id}
```

### Table Operations
```
GET    /api/v1/connections/{id}/tables/{table}/data
GET    /api/v1/connections/{id}/tables/{table}/structure
POST   /api/v1/connections/{id}/tables/{table}/data
PATCH  /api/v1/connections/{id}/tables/{table}/data
DELETE /api/v1/connections/{id}/tables/{table}/data
```

### Real-time (WebSocket)
```
WS     /ws
```

## Frontend Integration

### 1. Electron Desktop App Integration

#### Main Process Setup

```typescript
// electron/src/main/index.ts
import { APIManager } from './api-manager';
import { AuthManager } from './auth-manager';
import { DatabaseManager } from './database-manager';

const apiManager = new APIManager();
const authManager = new AuthManager(apiManager);
const databaseManager = new DatabaseManager(apiManager);

// Set up IPC handlers
ipcMain.handle('auth:login', async (_, credentials) => {
  return await authManager.login(credentials);
});

ipcMain.handle('connections:getAll', async () => {
  return await databaseManager.getConnections();
});

ipcMain.handle('query:execute', async (_, connectionId, query) => {
  return await databaseManager.executeQuery({ connectionId, query });
});
```

#### Renderer Process Integration

```typescript
// electron/src/renderer/api/client.ts
import apiClient from './client';

// Authentication
const { data: user } = await apiClient.auth.login(email, password);

// Database connections
const connections = await apiClient.connections.getAll();

// Query execution
const result = await apiClient.query.execute(connectionId, sqlQuery);

// Real-time updates
apiClient.websocket.subscribe('metrics', { connectionId });
```

#### React Hook Usage

```typescript
// electron/src/renderer/components/MyComponent.tsx
import { useAuth, useConnections, useQuery } from '../hooks/use-api';

function MyComponent() {
  const { user, isAuthenticated } = useAuth();
  const { connections, createConnection } = useConnections();
  const { executeQuery, currentQuery } = useQuery();

  if (!isAuthenticated) {
    return <AuthComponent onAuthSuccess={() => window.location.reload()} />;
  }

  return (
    <div>
      <h1>Welcome, {user?.name}!</h1>
      <ConnectionManager />
      <QueryExecutor onExecute={executeQuery} />
      {currentQuery && <QueryResults result={currentQuery} />}
    </div>
  );
}
```

### 2. Mobile App Integration

#### API Client Setup

```typescript
// mobile/src/api/client.ts
import apiClient from './client';

// Initialize the client
await apiClient.initialize();

// Authentication
await apiClient.auth.login(email, password);

// Real-time monitoring
await apiClient.websocket.connect();
apiClient.websocket.subscribe('metrics', handleMetricsUpdate);
```

#### Real-time Monitoring

```typescript
// mobile/src/screens/MonitoringScreen.tsx
import React, { useEffect, useState } from 'react';
import { useWebSocket } from '../hooks/use-api';

function MonitoringScreen() {
  const [metrics, setMetrics] = useState(null);

  useWebSocket('metrics', (data) => {
    setMetrics(data);
  });

  return (
    <View>
      <Text>Database Metrics</Text>
      {metrics && (
        <View>
          <Text>Connections: {metrics.activeConnections}</Text>
          <Text>Queries/sec: {metrics.queriesPerSecond}</Text>
          <Text>Avg Response Time: {metrics.averageResponseTime}ms</Text>
        </View>
      )}
    </View>
  );
}
```

### 3. Website Integration

#### LemonSqueezy Integration

```typescript
// website/src/components/PricingSection.tsx
import { createLemonSqueezyCheckout } from '../lib/lemonsqueezy';

async function handlePlanSelect(planId: string) {
  const result = await createLemonSqueezyCheckout({
    planId,
    planName: 'Professional',
    price: 29,
    isYearly: false,
    customerEmail: user?.email,
  });

  // Redirect to checkout
  window.location.href = result.checkoutUrl;
}
```

#### Backend Communication

```typescript
// website/src/pages/api/subscribe.ts
import { createLemonSqueezyClient } from '../../lib/lemonsqueezy';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const client = createLemonSqueezyClient({
      apiKey: process.env.LEMONSQUEEZY_API_KEY,
      storeId: process.env.LEMONSQUEEZY_STORE_ID,
      webhookSecret: process.env.LEMONSQUEEZY_WEBHOOK_SECRET,
      isDev: process.env.NODE_ENV === 'development',
    });

    try {
      const checkout = await client.createCheckout(req.body);
      res.status(200).json(checkout);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}
```

## Environment Configuration

### Backend Environment Variables

```bash
# Go Backend (.env)
SERVER_PORT=8080
DATABASE_URL=postgres://user:password@localhost:5432/queryflux
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=24h

# LemonSqueezy Integration
LEMONSQUEEZY_API_KEY=your-lemonsqueezy-api-key
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
LEMONSQUEEZY_STORE_ID=your-store-id

# WebSocket
WS_ENABLED=true
WS_PORT=8081
```

### Electron Environment Variables

```bash
# Electron (.env)
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_WS_URL=ws://localhost:8081/ws
VITE_APP_VERSION=1.0.0
```

### Mobile Environment Variables

```bash
# Mobile (.env)
API_BASE_URL=https://api.queryflux.com/api/v1
WS_URL=wss://api.queryflux.com/ws
PUSH_NOTIFICATION_KEY=your-push-key
```

### Website Environment Variables

```bash
# Website (.env.local)
NEXT_PUBLIC_API_URL=https://api.queryflux.com
LEMONSQUEEZY_API_KEY=your-lemonsqueezy-api-key
LEMONSQUEEZY_STORE_ID=your-store-id
LEMONSQUEEZY_WEBHOOK_SECRET=your-webhook-secret
```

## Database Setup

### PostgreSQL Setup

```sql
-- Create database
CREATE DATABASE queryflux;

-- Create user
CREATE USER queryflux_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE queryflux TO queryflux_user;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
```

### Migration Scripts

```sql
-- 001_create_users.sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    subscription_tier VARCHAR(50) DEFAULT 'free',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 002_create_connections.sql
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    database_name VARCHAR(255),
    username VARCHAR(255),
    password_encrypted TEXT,
    ssl_mode VARCHAR(20) DEFAULT 'prefer',
    status VARCHAR(20) DEFAULT 'disconnected',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 003_create_queries.sql
CREATE TABLE queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    connection_id UUID REFERENCES connections(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    execution_time INTEGER,
    rows_affected INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## WebSocket Integration

### Client-side WebSocket

```typescript
// electron/src/renderer/hooks/use-websocket.ts
export function useWebSocket(event: string, callback: (data: any) => void) {
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8081/ws');

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', event }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === event) {
        callback(message.data);
      }
    };

    return () => ws.close();
  }, [event, callback]);
}
```

### Server-side WebSocket Handler

```go
// backend/internal/adapters/websocket/hub.go
type Hub struct {
    clients    map[*Client]bool
    broadcast  chan []byte
    register   chan *Client
    unregister chan *Client
}

func (h *Hub) Run() {
    for {
        select {
        case client := <-h.register:
            h.clients[client] = true
        case client := <-h.unregister:
            if _, ok := h.clients[client]; ok {
                delete(h.clients, client)
                close(client.send)
            }
        case message := <-h.broadcast:
            for client := range h.clients {
                select {
                case client.send <- message:
                default:
                    close(client.send)
                    delete(h.clients, client)
                }
            }
        }
    }
}
```

## Testing Integration

### Frontend Testing

```typescript
// electron/tests/integration/auth.test.ts
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthComponent } from '../src/components/AuthComponent';

describe('Authentication Integration', () => {
  test('should login user successfully', async () => {
    render(<AuthComponent />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' }
    });

    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: 'password123' }
    });

    fireEvent.click(screen.getByText(/sign in/i));

    await waitFor(() => {
      expect(screen.getByText('Welcome, Test User')).toBeInTheDocument();
    });
  });
});
```

### Backend Testing

```go
// backend/tests/integration/auth_test.go
func TestAuthenticationFlow(t *testing.T) {
    // Test user registration
    user := &domain.User{
        Email:    "test@example.com",
        Password: "password123",
        Name:     "Test User",
    }

    createdUser, err := authService.Register(context.Background(), user)
    require.NoError(t, err)
    require.NotEmpty(t, createdUser.ID)

    // Test user login
    loginReq := &LoginRequest{
        Email:    "test@example.com",
        Password: "password123",
    }

    tokens, err := authService.Login(context.Background(), loginReq)
    require.NoError(t, err)
    require.NotEmpty(t, tokens.AccessToken)
}
```

## Deployment

### Backend Deployment

```yaml
# backend/render.yaml
services:
  - type: web
    name: queryflux-api
    runtime: go
    buildCommand: go build -o bin/server ./cmd/api
    startCommand: ./bin/server
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: queryflux-db
          property: connectionString
      - key: REDIS_URL
        fromService:
          type: redis
          name: queryflux-redis
          property: connectionString
```

### Electron Distribution

```json
{
  "build": {
    "appId": "com.queryflux.desktop",
    "productName": "QueryFlux",
    "mac": {
      "category": "public.app-category.developer-tools"
    },
    "win": {
      "target": ["nsis"]
    },
    "linux": {
      "target": ["AppImage", "deb"]
    }
  }
}
```

### Mobile Distribution

```yaml
# mobile/ios/Info.plist
<key>CFBundleIdentifier</key>
<string>com.queryflux.mobile</string>
<key>CFBundleVersion</key>
<string>1.0.0</string>
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure backend allows requests from frontend domains
2. **WebSocket Connection**: Check firewall settings and SSL certificates
3. **Authentication Failures**: Verify JWT secrets match between services
4. **Database Connections**: Test connection strings and credentials
5. **Payment Processing**: Validate LemonSqueezy webhooks and API keys

### Debug Mode

```typescript
// Enable debug logging
const apiClient = new QueryFluxAPI();
apiClient.setDebugMode(true);

// Monitor WebSocket events
apiClient.on('websocket:connected', () => {
  console.log('WebSocket connected');
});
```

## Support

For integration support:
- Check the [API Documentation](./API_DOCUMENTATION.md)
- Review the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- Open an issue on GitHub
- Contact the development team

This integration guide provides everything needed to successfully connect all QueryFlux components with the Go backend API.