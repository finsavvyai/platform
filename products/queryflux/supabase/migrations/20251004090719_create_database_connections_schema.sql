/*
  # Database Connections Management Schema

  1. New Tables
    - `connections`
      - `id` (uuid, primary key) - Unique identifier for each connection
      - `user_id` (uuid) - Reference to authenticated user
      - `name` (text) - User-defined connection name
      - `database_type` (text) - Type of database (postgresql, mysql, sqlite, supabase, etc.)
      - `host` (text) - Database host/server address
      - `port` (integer) - Database port number
      - `database_name` (text) - Name of the database
      - `username` (text) - Database username
      - `password` (text) - Encrypted password (stored securely)
      - `ssl_enabled` (boolean) - Whether SSL/TLS is enabled
      - `connection_url` (text) - Full connection URL (for URL-based connections)
      - `project` (text) - Project name for organization
      - `environment` (text) - Environment (development, staging, production)
      - `color` (text) - UI color for visual identification
      - `icon` (text) - Icon identifier for the connection
      - `last_connected_at` (timestamptz) - Last successful connection timestamp
      - `created_at` (timestamptz) - Connection creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      - `metadata` (jsonb) - Additional flexible metadata for database-specific settings

    - `connection_history`
      - `id` (uuid, primary key) - Unique identifier for history entry
      - `connection_id` (uuid) - Reference to connection
      - `user_id` (uuid) - Reference to authenticated user
      - `connected_at` (timestamptz) - Connection timestamp
      - `duration_seconds` (integer) - Connection duration
      - `queries_executed` (integer) - Number of queries during session
      - `status` (text) - Connection status (success, failed, timeout)
      - `error_message` (text) - Error message if connection failed
      - `metadata` (jsonb) - Additional session metadata

    - `saved_queries`
      - `id` (uuid, primary key) - Unique identifier for saved query
      - `user_id` (uuid) - Reference to authenticated user
      - `connection_id` (uuid) - Reference to connection
      - `name` (text) - Query name
      - `description` (text) - Query description
      - `query_text` (text) - The SQL/query content
      - `tags` (text[]) - Array of tags for organization
      - `is_favorite` (boolean) - Whether query is marked as favorite
      - `created_at` (timestamptz) - Query creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

    - `user_preferences`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid) - Reference to authenticated user
      - `theme` (text) - Selected theme name
      - `audio_enabled` (boolean) - Whether audio feedback is enabled
      - `default_query_limit` (integer) - Default row limit for queries
      - `auto_save_enabled` (boolean) - Whether auto-save is enabled
      - `preferences` (jsonb) - Additional user preferences
      - `created_at` (timestamptz) - Preferences creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Ensure users can only access their own connections and queries
    - Protect sensitive connection credentials

  3. Indexes
    - Add indexes on frequently queried columns for performance
    - Index user_id columns for efficient user-based queries
    - Index timestamps for history and sorting operations
*/

-- Create connections table
CREATE TABLE IF NOT EXISTS connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  database_type text NOT NULL,
  host text,
  port integer,
  database_name text,
  username text,
  password text,
  ssl_enabled boolean DEFAULT true,
  connection_url text,
  project text,
  environment text DEFAULT 'development',
  color text,
  icon text,
  last_connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create connection_history table
CREATE TABLE IF NOT EXISTS connection_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  connected_at timestamptz DEFAULT now(),
  duration_seconds integer,
  queries_executed integer DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Create saved_queries table
CREATE TABLE IF NOT EXISTS saved_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  query_text text NOT NULL,
  tags text[] DEFAULT '{}',
  is_favorite boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  theme text DEFAULT 'dark',
  audio_enabled boolean DEFAULT true,
  default_query_limit integer DEFAULT 1000,
  auto_save_enabled boolean DEFAULT true,
  preferences jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for connections table
CREATE POLICY "Users can view own connections"
  ON connections FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connections"
  ON connections FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connections"
  ON connections FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connections"
  ON connections FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for connection_history table
CREATE POLICY "Users can view own connection history"
  ON connection_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own connection history"
  ON connection_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own connection history"
  ON connection_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own connection history"
  ON connection_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for saved_queries table
CREATE POLICY "Users can view own queries"
  ON saved_queries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries"
  ON saved_queries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own queries"
  ON saved_queries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own queries"
  ON saved_queries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_preferences table
CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own preferences"
  ON user_preferences FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_project ON connections(project);
CREATE INDEX IF NOT EXISTS idx_connections_environment ON connections(environment);
CREATE INDEX IF NOT EXISTS idx_connections_database_type ON connections(database_type);
CREATE INDEX IF NOT EXISTS idx_connection_history_user_id ON connection_history(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_history_connection_id ON connection_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_history_connected_at ON connection_history(connected_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_queries_user_id ON saved_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_connection_id ON saved_queries(connection_id);
CREATE INDEX IF NOT EXISTS idx_saved_queries_tags ON saved_queries USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at columns
DROP TRIGGER IF EXISTS update_connections_updated_at ON connections;
CREATE TRIGGER update_connections_updated_at
  BEFORE UPDATE ON connections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_saved_queries_updated_at ON saved_queries;
CREATE TRIGGER update_saved_queries_updated_at
  BEFORE UPDATE ON saved_queries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
