# @finsavvyai/db Architecture

## Overview

A type-safe database abstraction library using Drizzle ORM, supporting both PostgreSQL and SQLite with a unified interface.

## Directory Structure

```
src/
├── schema/          # Drizzle table and relation definitions
│   ├── tables.ts    # Table definitions (pgTables, sqliteTables)
│   └── relations.ts # Relation definitions (pgRelations, sqliteRelations)
├── client/          # Database client factories and types
│   ├── postgres.ts  # PostgresClient with Pool management
│   ├── sqlite.ts    # SqliteClient with WAL mode
│   └── types.ts     # DatabaseClient interface, config types
├── repository/      # Data access layer (Repository pattern)
│   ├── base.ts      # Repository<T> interface and RepositoryOptions
│   ├── user.ts      # UserRepository CRUD implementation
│   └── subscription.ts # SubscriptionRepository CRUD implementation
├── seed.ts          # Database seeding with deterministic data
└── index.ts         # Barrel export (public API)

tests/
├── schema.test.ts   # Table definition tests (8 tests)
├── client.test.ts   # Client factory tests (11 tests)
├── repository.test.ts # Repository interface tests (12 tests)
├── seed.test.ts     # Seeding tests (10 tests)
└── exports.test.ts  # Export verification tests (12 tests)
```

## Core Components

### 1. Schema Layer
- **tables.ts**: Defines pgTables and sqliteTables using factory pattern
  - users: email (unique), role (default: 'user')
  - subscriptions: userId (FK), plan, status, dates
  - api_keys: userId (FK), key (unique), name
  - audit_log: userId (nullable FK), action, resource

- **relations.ts**: Defines relationships between tables
  - users → many subscriptions, api_keys, audit_logs
  - subscriptions/api_keys/audit_logs → one user

### 2. Client Layer
- **PostgresClient**: Drizzle client with node-postgres Pool
  - Max 10 connections by default
  - Health check on creation
  - Graceful shutdown

- **SqliteClient**: Drizzle client with better-sqlite3
  - WAL mode enabled for concurrency
  - In-memory or file-based

- **DatabaseClient interface**: Unified contract for both drivers

### 3. Repository Layer
- **Repository<T> interface**: Generic CRUD contract
  - findById(id): Promise<T | null>
  - findAll(opts?): Promise<T[]>
  - create(data): Promise<T>
  - update(id, data): Promise<T | null>
  - delete(id): Promise<boolean>

- **UserRepository**: CRUD for users
- **SubscriptionRepository**: CRUD for subscriptions + findByUserId

### 4. Seeding
- **seedDatabase(db)**: Creates deterministic test data
  - 3 sample users (alice, bob, charlie)
  - 2 subscriptions (pro, enterprise)
  - 2 API keys

## Design Patterns

### Dependency Injection
- Repositories accept DatabaseClient in constructor
- Clients are created via factory functions
- No global state

### Strategy Pattern
- Table selection based on client type (Postgres vs SQLite)
- Same repository code works with both databases

### Factory Pattern
- createPostgresClient(connectionString)
- createSqliteClient(filePath)

## Type Safety

- Strict TypeScript (noImplicitAny, strictNullChecks, etc.)
- All entities typed: User, Subscription, RepositoryOptions, etc.
- Drizzle-generated column types
- No any types except for Drizzle integration points

## File Size Compliance

All source files ≤ 200 lines:
- tables.ts: 63 lines
- relations.ts: 44 lines
- postgres.ts: 40 lines
- sqlite.ts: 33 lines
- user.ts: 77 lines
- subscription.ts: 90 lines
- seed.ts: 73 lines
- base.ts: 12 lines
- types.ts: 19 lines
- index.ts: 16 lines

## Testing Strategy

- 53+ unit tests across 5 test files
- Mocked database drivers (no live connections)
- Test markers: @vitest/unit, @vitest/integration
- Schema validation tests
- Client factory tests
- Repository interface tests
- Seed functionality tests
- Export verification tests

## Cross-Database Support

Both clients implement the same DatabaseClient interface:
```typescript
interface DatabaseClient {
  readonly db: Drizzle instance
  readonly config: { type: 'postgres' | 'sqlite' }
  close(): Promise<void>
}
```

Repositories detect database type and select appropriate tables/relations:
```typescript
const tables = this.isPostgres ? pgTables : sqliteTables;
```

## Usage Example

```typescript
// PostgreSQL
const db = await createPostgresClient('postgresql://localhost/app');
const users = new UserRepository(db);
const user = await users.findById('123');

// SQLite
const db = createSqliteClient('./app.db');
const users = new UserRepository(db);
const allUsers = await users.findAll({ limit: 10 });

// Seeding
await seedDatabase(db);
```
