# Supabase Setup Guide for Questro

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Choose your organization
4. Set project details:
   - **Name**: `questro-production`
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project"

## 2. Configure Database

Once your project is created:

1. Go to **Settings** → **Database**
2. Note down your connection details:
   - **Host**: `db.xxx.supabase.co`
   - **Database name**: `postgres`
   - **Port**: `5432`
   - **User**: `postgres`

## 3. Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxx.supabase.co`
   - **anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - **service_role secret**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## 4. Run Database Migrations

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## 5. Set Environment Variables

Add these to your deployment platform:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database URL for Drizzle
DATABASE_URL=postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres

# JWT Configuration
JWT_SECRET=your-jwt-secret-key
```

## 6. Enable Row Level Security (RLS)

Run these SQL commands in the Supabase SQL Editor:

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE recording_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorded_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_suites ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create policies for projects table
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

-- Create policies for recording_sessions table
CREATE POLICY "Users can view own recording sessions" ON recording_sessions
  FOR SELECT USING (auth.uid() = (SELECT user_id FROM projects WHERE id = project_id));

CREATE POLICY "Users can create recording sessions" ON recording_sessions
  FOR INSERT WITH CHECK (auth.uid() = (SELECT user_id FROM projects WHERE id = project_id));
```

## 7. Test Connection

```bash
# Test database connection
psql "postgresql://postgres:your-password@db.your-project-ref.supabase.co:5432/postgres"

# Or test with Node.js
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('your-url', 'your-anon-key');
console.log('Supabase client created successfully');
"
```

## 8. Setup Authentication

1. Go to **Authentication** → **Settings**
2. Configure:
   - **Site URL**: `https://questro.io`
   - **Redirect URLs**: `https://questro.io/auth/callback`
3. Enable providers you want (Google, GitHub, etc.)
4. Configure email templates under **Templates**

Your Supabase project is now ready for production!