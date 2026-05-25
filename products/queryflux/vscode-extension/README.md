# QueryFlux VS Code Extension

AI-powered database management extension for Visual Studio Code with support for 35+ database types.

## Features

- **Multi-Database Support**: PostgreSQL, MySQL, MongoDB, Redis, SQLite, Cassandra, Oracle, SQL Server, and more
- **AI-Powered Query Optimization**: Get intelligent suggestions to optimize your SQL queries
- **Schema Explorer**: Browse database schemas directly in the VS Code sidebar
- **Query Execution**: Execute SQL queries with results displayed in a dedicated panel
- **Rich SQL IntelliSense**: Advanced autocomplete for SQL keywords, tables, and columns
- **Query History**: Keep track of your executed queries
- **Results Export**: Export query results to CSV, JSON, or Excel formats
- **Connection Management**: Securely manage multiple database connections
- **SQL Snippets**: Quick access to common SQL patterns and templates

## Installation

### From VS Code Marketplace
1. Open VS Code
2. Press `Ctrl+Shift+X` (or `Cmd+Shift+X` on Mac)
3. Search for "QueryFlux"
4. Click **Install**

### From File
1. Download the latest `.vsix` file from [Releases](https://github.com/queryflux/vscode-extension/releases)
2. Open VS Code
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
4. Type "Extensions: Install from VSIX"
5. Select the downloaded file

## Quick Start

1. **Connect to a Database**:
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "QueryFlux: Connect to Database"
   - Select your database type and enter connection details

2. **Execute a Query**:
   - Open a new SQL file (or use existing)
   - Write your SQL query
   - Press `Ctrl+Enter` (or `Cmd+Enter` on Mac) to execute
   - View results in the QueryFlux panel

3. **Browse Schema**:
   - Use the "QueryFlux Connections" sidebar to view connected databases
   - Expand database objects to browse tables, columns, and relationships

## Supported Databases

| Database | Status | Features |
|----------|--------|----------|
| PostgreSQL | ✅ Full Support | Connections, Queries, Schema, SSL |
| MySQL | ✅ Full Support | Connections, Queries, Schema, SSL |
| MongoDB | ✅ Full Support | Connections, Queries, Schema Explorer |
| Redis | ✅ Full Support | Connections, Commands |
| SQLite | ✅ Full Support | Connections, Queries, Schema |
| Cassandra | ✅ Full Support | Connections, Queries |
| Oracle | ✅ Full Support | Connections, Queries, Schema |
| SQL Server | ✅ Full Support | Connections, Queries, Schema |

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| `QueryFlux: Connect to Database` | - | Open connection dialog |
| `QueryFlux: Execute Query` | `Ctrl+Enter` | Execute current query |
| `QueryFlux: New Query Editor` | `Ctrl+N` | Open new SQL editor |
| `QueryFlux: Browse Schema` | - | Show database schema |
| `QueryFlux: Explain Query` | - | Show query execution plan |
| `QueryFlux: Optimize Query with AI` | - | Get AI optimization suggestions |
| `QueryFlux: Export Results` | - | Export query results |
| `QueryFlux: Refresh Schema` | - | Refresh database schema |

## Settings

### QueryFlux Configuration
```json
{
  "queryflux.defaultConnectionTimeout": 30000,
  "queryflux.maxResultRows": 1000,
  "queryflux.autoComplete": true,
  "queryflux.formatOnSave": true,
  "queryflux.aiOptimization": true
}
```

### Environment Variables
For sensitive information like API keys, you can use environment variables:
```bash
export QUERYFLUX_AI_API_KEY="your-api-key"
export QUERYFLUX_LOG_LEVEL="info"
```

## SQL Snippets

The extension includes 25+ SQL snippets for common patterns:

- `sel` - SELECT with LIMIT
- `selw` - SELECT with WHERE
- `selj` - SELECT with JOIN
- `ins` - INSERT statement
- `upd` - UPDATE statement
- `del` - DELETE statement
- `ct` - CREATE TABLE
- `ci` - CREATE INDEX
- `case` - CASE WHEN statement
- `cte` - Common Table Expression
- And many more...

Type the snippet prefix and press `Tab` to expand.

## Query Examples

### Basic Query
```sql
SELECT * FROM users WHERE status = 'active' LIMIT 10;
```

### Join with Optimization
```sql
SELECT u.name, p.title, p.created_at
FROM users u
INNER JOIN posts p ON u.id = p.user_id
WHERE u.created_at > '2023-01-01'
ORDER BY p.created_at DESC
LIMIT 100;
```

### AI Optimization
1. Write your query
2. Select the query text
3. Press `Ctrl+Shift+P`
4. Type "QueryFlux: Optimize Query with AI"
5. View optimization suggestions

## Results Panel

The QueryFlux Results Panel provides:
- **Tabular Display**: Results in a sortable, filterable table
- **Export Options**: CSV, JSON, Excel formats
- **Query Statistics**: Execution time, rows affected
- **Result Paging**: Navigate large result sets
- **Copy to Clipboard**: Copy selected cells or entire result

## Security

- **Encrypted Connections**: All database connections use SSL/TLS when available
- **Secure Storage**: Connection credentials stored in VS Code's secure storage
- **No Data Tracking**: No query data or results are sent to external servers
- **Local Processing**: All query execution happens locally

## Troubleshooting

### Connection Issues
1. Verify database server is running
2. Check firewall settings
3. Validate connection credentials
4. Ensure database user has necessary permissions

### SSL Certificate Errors
```json
{
  "queryflux.ssl.rejectUnauthorized": false
}
```
⚠️ **Warning**: Only disable SSL verification in development environments.

### Large Result Sets
```json
{
  "queryflux.maxResultRows": 10000
}
```

### Performance Issues
1. Use query optimization features
2. Limit result sets with WHERE clauses
3. Add appropriate database indexes
4. Use query execution plans (`EXPLAIN`)

## Extension API

The QueryFlux extension provides an API for other extensions to use:

```typescript
// Get connection manager
const queryflux = vscode.extensions.getExtension('queryflux.queryflux')?.exports;
const connectionManager = queryflux?.connectionManager;

// Execute query programmatically
const result = await queryflux?.executeQuery('SELECT * FROM users');
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/queryflux/vscode-extension.git
cd vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run tests
npm test

# Start development
npm run watch
```

### Building
```bash
# Create .vsix package
npm run package

# Create production package
npm run package:prod
```

## Changelog

### v1.0.0
- Initial release
- Support for 8 major database types
- AI-powered query optimization
- Schema explorer
- Query results panel
- SQL snippets and IntelliSense

## Support

- **Documentation**: [docs.queryflux.com](https://docs.queryflux.com)
- **Issues**: [GitHub Issues](https://github.com/queryflux/vscode-extension/issues)
- **Community**: [Discord](https://discord.gg/queryflux)
- **Email**: support@queryflux.com

## License

This extension is licensed under the [MIT License](LICENSE).

## Privacy Policy

QueryFlux respects your privacy:
- No query data is sent to external servers
- Connection credentials are stored securely locally
- No usage tracking or analytics
- Optional AI features may send anonymized queries for optimization (opt-in)

---

**QueryFlux** - AI-powered database management for developers