/*
  # Add Schema Support and Extensions System

  1. New Tables
    - `connection_schemas` - Store schemas for each connection
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key)
      - `schema_name` (text)
      - `is_default` (boolean)
      - `created_at` (timestamp)
    
    - `custom_themes` - Store user-created themes
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `name` (text)
      - `colors` (jsonb)
      - `is_public` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `extensions` - Available extensions/plugins
      - `id` (uuid, primary key)
      - `name` (text)
      - `slug` (text, unique)
      - `description` (text)
      - `version` (text)
      - `author` (text)
      - `icon` (text)
      - `category` (text)
      - `is_free` (boolean)
      - `price` (numeric)
      - `features` (jsonb)
      - `permissions` (jsonb)
      - `install_count` (integer)
      - `rating` (numeric)
      - `is_published` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_extensions` - Track user-installed extensions
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `extension_id` (uuid, foreign key)
      - `is_enabled` (boolean)
      - `config` (jsonb)
      - `installed_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add appropriate policies for each table
*/

-- Connection Schemas Table
CREATE TABLE IF NOT EXISTS connection_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  schema_name text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, schema_name)
);

ALTER TABLE connection_schemas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view schemas for their connections"
  ON connection_schemas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_schemas.connection_id
      AND connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage schemas for their connections"
  ON connection_schemas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_schemas.connection_id
      AND connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update schemas for their connections"
  ON connection_schemas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_schemas.connection_id
      AND connections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_schemas.connection_id
      AND connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete schemas for their connections"
  ON connection_schemas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_schemas.connection_id
      AND connections.user_id = auth.uid()
    )
  );

-- Custom Themes Table
CREATE TABLE IF NOT EXISTS custom_themes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  colors jsonb NOT NULL,
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE custom_themes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own themes and public themes"
  ON custom_themes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create own themes"
  ON custom_themes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own themes"
  ON custom_themes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own themes"
  ON custom_themes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Extensions Table
CREATE TABLE IF NOT EXISTS extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  version text NOT NULL DEFAULT '1.0.0',
  author text,
  icon text DEFAULT 'package',
  category text DEFAULT 'utility',
  is_free boolean DEFAULT true,
  price numeric(10, 2) DEFAULT 0,
  features jsonb DEFAULT '[]'::jsonb,
  permissions jsonb DEFAULT '[]'::jsonb,
  install_count integer DEFAULT 0,
  rating numeric(2, 1) DEFAULT 0,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published extensions"
  ON extensions
  FOR SELECT
  TO authenticated
  USING (is_published = true);

-- User Extensions Table
CREATE TABLE IF NOT EXISTS user_extensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  extension_id uuid REFERENCES extensions(id) ON DELETE CASCADE NOT NULL,
  is_enabled boolean DEFAULT true,
  config jsonb DEFAULT '{}'::jsonb,
  installed_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, extension_id)
);

ALTER TABLE user_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own extensions"
  ON user_extensions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can install extensions"
  ON user_extensions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own extensions"
  ON user_extensions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can uninstall extensions"
  ON user_extensions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connection_schemas_connection_id ON connection_schemas(connection_id);
CREATE INDEX IF NOT EXISTS idx_custom_themes_user_id ON custom_themes(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_themes_public ON custom_themes(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_extensions_slug ON extensions(slug);
CREATE INDEX IF NOT EXISTS idx_extensions_category ON extensions(category);
CREATE INDEX IF NOT EXISTS idx_user_extensions_user_id ON user_extensions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_extensions_extension_id ON user_extensions(extension_id);

-- Insert some sample extensions
INSERT INTO extensions (name, slug, description, category, is_free, features, permissions, icon) VALUES
  ('Query Formatter', 'query-formatter', 'Automatically format and beautify SQL queries with customizable style options', 'productivity', true, '["Auto-format on save", "Multiple formatting styles", "Keyboard shortcuts"]'::jsonb, '["read_queries", "modify_queries"]'::jsonb, 'wand-2'),
  ('Database Compare', 'db-compare', 'Compare schemas and data between two databases to identify differences', 'tools', true, '["Schema comparison", "Data diff", "Export reports"]'::jsonb, '["read_schema", "read_data"]'::jsonb, 'git-compare'),
  ('AI Query Optimizer', 'ai-query-optimizer', 'Use AI to analyze and optimize slow queries for better performance', 'ai', false, '["Performance analysis", "Query suggestions", "Execution plans"]'::jsonb, '["read_queries", "analyze_performance"]'::jsonb, 'zap'),
  ('Export Wizard', 'export-wizard', 'Export query results to CSV, JSON, Excel, and more formats', 'productivity', true, '["Multiple formats", "Scheduled exports", "Custom templates"]'::jsonb, '["read_data", "export_data"]'::jsonb, 'download'),
  ('Data Generator', 'data-generator', 'Generate realistic test data for your database tables', 'development', false, '["Smart data generation", "Custom rules", "Bulk insert"]'::jsonb, '["read_schema", "write_data"]'::jsonb, 'database'),
  ('Collaboration Hub', 'collaboration-hub', 'Share queries, schemas, and collaborate with your team in real-time', 'collaboration', false, '["Real-time sync", "Team workspaces", "Comments"]'::jsonb, '["share_queries", "team_access"]'::jsonb, 'users')
ON CONFLICT (slug) DO NOTHING;
