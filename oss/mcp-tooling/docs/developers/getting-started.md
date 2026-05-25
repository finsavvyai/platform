# Developer Getting Started Guide

Welcome to the MCPOverflow developer documentation! This guide will help you set up your development environment and contribute to the project.

## 🎯 What You'll Learn

- Setting up your local development environment
- Understanding the project architecture
- Running the application locally
- Making your first contribution
- Development best practices

## 📋 Prerequisites

### Required Software

- **Node.js** (v18+ or latest LTS)
- **npm** (v9+) or **pnpm** (v8+)
- **Git** (latest version)
- **PostgreSQL** (v14+) - for local development
- **VS Code** (recommended) with extensions

### Required Accounts

- **GitHub** account for code collaboration
- **Supabase** account for backend services
- **Cloudflare** account (optional) for deployment

## 🚀 Quick Setup

### 1. Clone the Repository

```bash
# Clone the repository
git clone https://github.com/mcpoverflow/mcpoverflow.git
cd mcpoverflow

# Install dependencies
npm install

# or using pnpm
pnpm install
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env.local

# Edit environment variables
nano .env.local
```

### 3. Database Setup

#### Option A: Supabase (Recommended)

```bash
# Install Supabase CLI
npm install -g @supabase/cli

# Link to your Supabase project
supabase link --project-ref YOUR_PROJECT_REF

# Run database migrations
supabase db push

# Start local development
supabase start
```

#### Option B: Local PostgreSQL

```bash
# Start PostgreSQL (using Docker)
docker run --name postgres-mcpoverflow \
  -e POSTGRES_PASSWORD=mcpoverflow \
  -p 5432:5432 \
  -d postgres:14

# Apply migrations
psql -h localhost -U postgres -d mcpoverflow -f supabase/migrate.sql
```

### 4. Start Development Server

```bash
# Start the frontend development server
npm run dev

# The app will be available at http://localhost:5173
```

## 🏗️ Project Architecture

### Directory Structure

```
mcpoverflow/
├── src/                          # Frontend source code
│   ├── components/               # Reusable UI components
│   │   ├── Layout.tsx          # Main app layout
│   │   ├── Header.tsx          # Navigation header
│   │   └── ProtectedRoute.tsx  # Auth wrapper
│   ├── contexts/                # React contexts
│   │   ├── AuthContext.tsx     # Authentication state
│   │   └── ThemeContext.tsx    # Theme management
│   ├── lib/                     # Core libraries
│   │   ├── supabase.ts         # Supabase client
│   │   ├── generator.ts        # OpenAPI generation
│   │   ├── security.ts         # Security utilities
│   │   └── api-security.ts     # API security layer
│   ├── pages/                   # Page components
│   │   ├── Home.tsx            # Landing page
│   │   ├── Dashboard.tsx       # Main dashboard
│   │   ├── Generate.tsx        # Connector generation
│   │   └── Settings.tsx        # User settings
│   ├── types/                   # TypeScript definitions
│   │   └── database.ts         # Database types
│   └── utils/                   # Utility functions
├── supabase/                     # Database schema and migrations
│   ├── migrations/              # Database migration files
│   ├── migrate.sql              # Migration runner
│   └── rollback.sql             # Rollback procedures
├── docs/                         # Project documentation
├── .luna/                        # Luna specifications
└── tests/                        # Test files
```

### Technology Stack

#### Frontend

- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Lucide React** for icons

#### Backend & Database

- **Supabase** for authentication and database
- **PostgreSQL** as the primary database
- **Row Level Security (RLS)** for data access control
- **Edge Functions** for serverless operations

#### Development Tools

- **ESLint** for code linting
- **Prettier** for code formatting
- **Husky** for git hooks
- **Vitest** for unit testing

## 🔧 Development Workflow

### 1. Create a Feature Branch

```bash
# Create and switch to a new branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/issue-description
```

### 2. Make Your Changes

- Follow the existing code style
- Add TypeScript types for new code
- Include tests for new functionality
- Update documentation as needed

### 3. Run Tests

```bash
# Run unit tests
npm run test

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Run all checks
npm run check
```

### 4. Commit Your Changes

```bash
# Stage your changes
git add .

# Commit with conventional commit message
git commit -m "feat: add new feature description"

# Push to your fork
git push origin feature/your-feature-name
```

### 5. Create a Pull Request

- Go to the GitHub repository
- Click "New Pull Request"
- Fill in the PR template
- Request review from maintainers

## 🧪 Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Integration Tests

```bash
# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

### Database Tests

```bash
# Run database schema tests
npm run test:db

# Test migrations
npm run test:migrations
```

## 📝 Code Style and Standards

### TypeScript Guidelines

```typescript
// Use interfaces for type definitions
interface User {
  id: string;
  email: string;
  displayName?: string;
}

// Use proper typing for React components
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary'
}) => {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### Component Guidelines

```tsx
// Use functional components with hooks
const Component: React.FC<Props> = ({ prop1, prop2 }) => {
  const [state, setState] = useState(initialState)

  // Handle side effects
  useEffect(() => {
    // Effect logic
    return () => {
      // Cleanup
    }
  }, [dependencies])

  return <div className="component">{/* JSX content */}</div>
}

// Export with display name for debugging
Component.displayName = 'Component'
```

### Security Best Practices

```typescript
// Always validate inputs
const sanitizeInput = (input: string): string => {
  return input.replace(/[<>]/g, '').trim()
}

// Use the secure API client
import { secureAPI } from '../lib/api-security'

const handleSubmit = async (data: FormData) => {
  try {
    const response = await secureAPI.post('/api/endpoint', data)
    return response.data
  } catch (error) {
    console.error('API error:', error)
    throw error
  }
}
```

## 🔐 Security Considerations

### Input Validation

- Always validate user inputs on both client and server
- Use the `InputSanitizer` utility for common sanitization
- Implement rate limiting for API endpoints

### Authentication

- Use Supabase Auth for user management
- Implement proper session management
- Never expose sensitive data in client-side code

### API Security

- Use CSRF tokens for state-changing operations
- Implement proper error handling without information leakage
- Validate and sanitize all API inputs

## 📊 Database Development

### Schema Changes

1. Create a new migration file:

   ```bash
   # Format: YYYYMMDD_NNN_description.sql
   touch supabase/migrations/20251102_005_new_feature.sql
   ```

2. Write your migration SQL:

   ```sql
   -- Add new table
   CREATE TABLE public.new_table (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Enable RLS
   ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;
   ```

3. Create rollback function:

   ```sql
   CREATE OR REPLACE FUNCTION public.rollback_20251102_005_new_feature()
   RETURNS VOID AS $$
   BEGIN
     DROP TABLE IF EXISTS public.new_table;
   END;
   $$ LANGUAGE plpgsql;
   ```

4. Test your migration:

   ```bash
   # Apply migration
   supabase db push

   # Test rollback
   SELECT public.rollback_20251102_005_new_feature();
   ```

### Database Functions

```sql
-- Follow naming conventions
CREATE OR REPLACE FUNCTION public.get_user_connectors(
  p_user_id UUID,
  p_status connector_status DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  status connector_status
) AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.status
  FROM public.connectors c
  WHERE c.owner_id = p_user_id
    AND (p_status IS NULL OR c.status = p_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## 🚀 Deployment

### Frontend Deployment

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Vercel (example)
vercel --prod
```

### Backend Deployment

```bash
# Deploy database changes
supabase db push

# Deploy edge functions
supabase functions deploy

# Update environment variables
supabase secrets set YOUR_SECRET=value
```

## 🤝 Contributing Guidelines

### Before Contributing

1. Read the [Code of Conduct](./code-of-conduct.md)
2. Check existing issues and PRs
3. Discuss large changes in an issue first

### Making Changes

1. **Small, focused commits** - One logical change per commit
2. **Clear commit messages** - Use conventional commit format
3. **Tests included** - Add tests for new functionality
4. **Documentation updated** - Keep docs in sync with code

### Pull Request Process

1. **Fork the repository** and create a feature branch
2. **Make your changes** following the coding standards
3. **Add tests** for your changes
4. **Update documentation** as needed
5. **Submit a pull request** with a clear description
6. **Address feedback** from maintainers
7. **Get merged**! 🎉

## 🐛 Troubleshooting

### Common Issues

**Environment Variables Not Loading**

```bash
# Check .env.local file exists
ls -la .env.local

# Restart development server
npm run dev
```

**Database Connection Issues**

```bash
# Check Supabase configuration
supabase status

# Test database connection
supabase db shell
```

**TypeScript Errors**

```bash
# Clear build cache
rm -rf node_modules/.vite

# Reinstall dependencies
npm install
```

**Test Failures**

```bash
# Run tests with verbose output
npm run test -- --verbose

# Run specific test file
npm run test src/path/to/test.test.ts
```

### Getting Help

- **📖 Documentation**: Check existing docs first
- **🐛 Issues**: Search existing issues before creating new ones
- **💬 Discussions**: Ask questions in GitHub Discussions
- **📧 Email**: Contact dev@mcpoverflow.com

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev/)

---

Ready to start contributing? Check out our [Good First Issues](https://github.com/mcpoverflow/mcpoverflow/issues?q=is%3Aopen+is%3Aissue+label%3A%22good+first+issue%22) to find beginner-friendly tasks.
