/*
  # Plugin Installation and Management System

  1. New Tables
    - `user_plugins`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `plugin_id` (text, plugin identifier)
      - `plugin_name` (text)
      - `is_enabled` (boolean, default true)
      - `configuration` (jsonb, plugin-specific config)
      - `installed_at` (timestamptz)
      - `last_used_at` (timestamptz)
    
    - `plugin_configurations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `plugin_id` (text)
      - `table_name` (text)
      - `field_name` (text)
      - `masking_type` (text)
      - `masking_config` (jsonb)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own plugins and configurations
*/

-- User plugins table
CREATE TABLE IF NOT EXISTS user_plugins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id text NOT NULL,
  plugin_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  configuration jsonb DEFAULT '{}'::jsonb,
  installed_at timestamptz DEFAULT now(),
  last_used_at timestamptz DEFAULT now(),
  UNIQUE(user_id, plugin_id)
);

ALTER TABLE user_plugins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plugins"
  ON user_plugins
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plugins"
  ON user_plugins
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plugins"
  ON user_plugins
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plugins"
  ON user_plugins
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Plugin configurations table (for masking and other configs)
CREATE TABLE IF NOT EXISTS plugin_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plugin_id text NOT NULL,
  table_name text NOT NULL,
  field_name text,
  masking_type text,
  masking_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE plugin_configurations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own configurations"
  ON plugin_configurations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own configurations"
  ON plugin_configurations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own configurations"
  ON plugin_configurations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own configurations"
  ON plugin_configurations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_plugins_user_id ON user_plugins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_plugins_plugin_id ON user_plugins(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_user_id ON plugin_configurations(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_plugin_id ON plugin_configurations(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_configurations_table ON plugin_configurations(table_name);
