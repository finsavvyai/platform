/*
  # Add Editor Tabs and Connection State

  1. New Tables
    - `connection_tabs` - Store SQL editor tabs for each connection
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key)
      - `user_id` (uuid, foreign key)
      - `title` (text)
      - `content` (text)
      - `is_active` (boolean)
      - `order_index` (integer)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `connection_objects` - Cache database objects (tables, views, functions, procedures)
      - `id` (uuid, primary key)
      - `connection_id` (uuid, foreign key)
      - `schema_name` (text)
      - `object_type` (text) - table, view, function, procedure
      - `object_name` (text)
      - `definition` (text)
      - `columns` (jsonb)
      - `metadata` (jsonb)
      - `last_synced_at` (timestamp)

  2. Updates
    - Add `readonly_mode` column to connections table
    - Add `requires_confirmation` column to connections for production safety

  3. Security
    - Enable RLS on new tables
    - Add appropriate policies
*/

-- Connection Tabs Table
CREATE TABLE IF NOT EXISTS connection_tabs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT 'Untitled Query',
  content text DEFAULT '',
  is_active boolean DEFAULT false,
  order_index integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE connection_tabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tabs"
  ON connection_tabs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tabs"
  ON connection_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tabs"
  ON connection_tabs
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tabs"
  ON connection_tabs
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Connection Objects Table
CREATE TABLE IF NOT EXISTS connection_objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE NOT NULL,
  schema_name text NOT NULL DEFAULT 'public',
  object_type text NOT NULL,
  object_name text NOT NULL,
  definition text,
  columns jsonb DEFAULT '[]'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  last_synced_at timestamptz DEFAULT now(),
  UNIQUE(connection_id, schema_name, object_type, object_name)
);

ALTER TABLE connection_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view objects for their connections"
  ON connection_objects
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_objects.connection_id
      AND connections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage objects for their connections"
  ON connection_objects
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_objects.connection_id
      AND connections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connections
      WHERE connections.id = connection_objects.connection_id
      AND connections.user_id = auth.uid()
    )
  );

-- Add readonly mode and confirmation flags to connections
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'readonly_mode'
  ) THEN
    ALTER TABLE connections ADD COLUMN readonly_mode boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'requires_confirmation'
  ) THEN
    ALTER TABLE connections ADD COLUMN requires_confirmation boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE connections ADD COLUMN is_active boolean DEFAULT false;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_connection_tabs_connection_id ON connection_tabs(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_tabs_user_id ON connection_tabs(user_id);
CREATE INDEX IF NOT EXISTS idx_connection_objects_connection_id ON connection_objects(connection_id);
CREATE INDEX IF NOT EXISTS idx_connection_objects_type ON connection_objects(object_type);

-- Function to auto-enable confirmation for production environments
CREATE OR REPLACE FUNCTION set_production_safety()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.environment = 'production' THEN
    NEW.requires_confirmation := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ensure_production_safety'
  ) THEN
    CREATE TRIGGER ensure_production_safety
      BEFORE INSERT OR UPDATE ON connections
      FOR EACH ROW
      EXECUTE FUNCTION set_production_safety();
  END IF;
END $$;
