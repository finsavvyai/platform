/*
  # Add AI and Docker Features

  1. New Tables
    - `ai_providers` - Store AI provider configurations
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `name` (text) - Provider name
      - `provider_type` (text) - openai, anthropic, custom, etc.
      - `api_key` (text) - Encrypted API key
      - `api_endpoint` (text) - Custom endpoint URL
      - `model` (text) - Model name
      - `is_default` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `ai_conversations` - Store AI assistant chat history
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `messages` (jsonb) - Array of messages
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `query_analysis` - Store AI query analysis results
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key)
      - `query` (text)
      - `execution_time_ms` (integer)
      - `security_score` (integer) - 0-100
      - `performance_score` (integer) - 0-100
      - `suggestions` (jsonb) - Array of AI suggestions
      - `risks` (jsonb) - Array of security risks
      - `created_at` (timestamp)

    - `index_suggestions` - Store AI index recommendations
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key)
      - `table_name` (text)
      - `column_names` (text[])
      - `index_type` (text) - btree, hash, gin, etc.
      - `reason` (text)
      - `estimated_improvement` (text)
      - `implemented` (boolean)
      - `created_at` (timestamp)

    - `docker_instances` - Track Docker database instances
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `container_id` (text)
      - `container_name` (text)
      - `database_type` (text)
      - `port` (integer)
      - `status` (text) - running, stopped, error
      - `created_at` (timestamp)
      - `stopped_at` (timestamp)

  2. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users to manage their own data
*/

-- AI Providers Table
CREATE TABLE IF NOT EXISTS ai_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('openai', 'anthropic', 'ollama', 'custom')),
  api_key text,
  api_endpoint text,
  model text NOT NULL,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI providers"
  ON ai_providers
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- AI Conversations Table
CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  messages jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI conversations"
  ON ai_conversations
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Query Analysis Table
CREATE TABLE IF NOT EXISTS query_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  query text NOT NULL,
  execution_time_ms integer,
  security_score integer CHECK (security_score >= 0 AND security_score <= 100),
  performance_score integer CHECK (performance_score >= 0 AND performance_score <= 100),
  suggestions jsonb DEFAULT '[]'::jsonb,
  risks jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE query_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analysis for own connections"
  ON query_analysis
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = query_analysis.connection_id
      AND connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create analysis for own connections"
  ON query_analysis
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = query_analysis.connection_id
      AND connections.user_id = auth.uid()
    )
  );

-- Index Suggestions Table
CREATE TABLE IF NOT EXISTS index_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  table_name text NOT NULL,
  column_names text[] NOT NULL,
  index_type text DEFAULT 'btree' CHECK (index_type IN ('btree', 'hash', 'gin', 'gist', 'brin')),
  reason text NOT NULL,
  estimated_improvement text,
  implemented boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE index_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage index suggestions for own connections"
  ON index_suggestions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = index_suggestions.connection_id
      AND connections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = index_suggestions.connection_id
      AND connections.user_id = auth.uid()
    )
  );

-- Docker Instances Table
CREATE TABLE IF NOT EXISTS docker_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  container_id text,
  container_name text NOT NULL,
  database_type text NOT NULL,
  port integer NOT NULL,
  status text DEFAULT 'running' CHECK (status IN ('running', 'stopped', 'error')),
  created_at timestamptz DEFAULT now(),
  stopped_at timestamptz
);

ALTER TABLE docker_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own Docker instances"
  ON docker_instances
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_providers_user_id ON ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_is_default ON ai_providers(user_id, is_default) WHERE is_default = true;
CREATE INDEX IF NOT EXISTS idx_ai_conversations_connection_id ON ai_conversations(connection_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_query_analysis_connection_id ON query_analysis(connection_id);
CREATE INDEX IF NOT EXISTS idx_query_analysis_created_at ON query_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_index_suggestions_connection_id ON index_suggestions(connection_id);
CREATE INDEX IF NOT EXISTS idx_index_suggestions_implemented ON index_suggestions(connection_id, implemented) WHERE implemented = false;
CREATE INDEX IF NOT EXISTS idx_docker_instances_user_id ON docker_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_docker_instances_status ON docker_instances(user_id, status);
