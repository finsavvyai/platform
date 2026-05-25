/*
  # Add Projects Table and Connection Hierarchy

  1. New Tables
    - `projects` - Store user projects
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `name` (text)
      - `description` (text)
      - `color` (text)
      - `icon` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Changes
    - Update `connections` table to reference projects via `project_id`
    - Connections are organized as: Project -> Environment -> Connections

  3. Security
    - Enable RLS on projects table
    - Add policies for authenticated users to manage their own projects
*/

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  color text DEFAULT '#6366f1',
  icon text DEFAULT 'folder',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Update connections table to add project reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'connections' AND column_name = 'project_id'
  ) THEN
    ALTER TABLE connections ADD COLUMN project_id uuid REFERENCES projects(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_project_id ON connections(project_id);
