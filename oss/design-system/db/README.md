# @finsavvyai/db

Database abstraction library using Drizzle ORM with PostgreSQL and SQLite support.

## Features

- **Multi-database support**: PostgreSQL and SQLite with a unified interface
- **Type-safe ORM**: Full TypeScript support with Drizzle ORM
- **Repository pattern**: Generic CRUD operations with dependency injection
- **Schema definitions**: Strongly typed table and relation definitions
- **Seeding**: Built-in database seeding with deterministic test data

## Installation

```bash
npm install @finsavvyai/db drizzle-orm pg better-sqlite3
```

## Usage

### PostgreSQL Client

```typescript
import { createPostgresClient, UserRepository } from '@finsavvyai/db';

const db = await createPostgresClient('postgresql://user:pass@localhost/dbname');
const users = new UserRepository(db);

const user = await users.findById('user-id');
```

### SQLite Client

```typescript
import { createSqliteClient, UserRepository } from '@finsavvyai/db';

const db = createSqliteClient('./data.db');
const users = new UserRepository(db);

const allUsers = await users.findAll({ limit: 10 });
```

### Seeding

```typescript
import { seedDatabase } from '@finsavvyai/db';

await seedDatabase(db);
```

## Schema

### Tables

- **users**: User accounts with role-based access
- **subscriptions**: User subscription plans and status
- **api_keys**: API credentials per user
- **audit_log**: Audit trail of user actions

### Relations

- Users have many subscriptions, API keys, and audit logs
- Subscriptions and API keys belong to users
- Audit log entries reference users (nullable)

## Architecture

- **Clients**: Database client factories (`createPostgresClient`, `createSqliteClient`)
- **Repositories**: Data access layer with generic CRUD interface
- **Schema**: Drizzle table and relation definitions
- **Types**: Shared interfaces and type definitions

## Testing

```bash
npm test
npm run test:cov
```

All source files are ≤200 lines with strict TypeScript configuration.
