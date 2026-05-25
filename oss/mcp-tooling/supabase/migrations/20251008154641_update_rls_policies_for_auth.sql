/*
  # Update RLS Policies for User Ownership

  ## Changes
  Updates Row Level Security policies to enforce user ownership of connectors.
  
  ## Policy Changes
  
  ### Connectors Table
  - Remove public read policy
  - Add authenticated user can view their own connectors
  - Update insert policy to set owner_id to authenticated user
  - Update update/delete policies to check ownership
  
  ### Jobs Table  
  - Update policies to check connector ownership
  
  ### Usage Metrics Table
  - Update policies to check connector ownership
  
  ## Security Notes
  - All data access now requires authentication
  - Users can only access their own connectors and related data
  - Owner ID is automatically set from authenticated user session
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view connectors" ON connectors;
DROP POLICY IF EXISTS "Authenticated users can insert connectors" ON connectors;
DROP POLICY IF EXISTS "Authenticated users can update connectors" ON connectors;
DROP POLICY IF EXISTS "Authenticated users can delete connectors" ON connectors;

DROP POLICY IF EXISTS "Anyone can view jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can insert jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can update jobs" ON jobs;

DROP POLICY IF EXISTS "Anyone can view metrics" ON usage_metrics;
DROP POLICY IF EXISTS "Authenticated users can insert metrics" ON usage_metrics;
DROP POLICY IF EXISTS "Authenticated users can update metrics" ON usage_metrics;

-- Connectors: Users can view their own connectors
CREATE POLICY "Users can view own connectors"
  ON connectors FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid()::text);

-- Connectors: Users can insert connectors (owner_id set to their user ID)
CREATE POLICY "Users can insert own connectors"
  ON connectors FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid()::text);

-- Connectors: Users can update their own connectors
CREATE POLICY "Users can update own connectors"
  ON connectors FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid()::text)
  WITH CHECK (owner_id = auth.uid()::text);

-- Connectors: Users can delete their own connectors
CREATE POLICY "Users can delete own connectors"
  ON connectors FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid()::text);

-- Jobs: Users can view jobs for their connectors
CREATE POLICY "Users can view own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = jobs.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  );

-- Jobs: Users can insert jobs for their connectors
CREATE POLICY "Users can insert own jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = jobs.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  );

-- Jobs: Users can update jobs for their connectors
CREATE POLICY "Users can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = jobs.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = jobs.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  );

-- Usage Metrics: Users can view metrics for their connectors
CREATE POLICY "Users can view own metrics"
  ON usage_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = usage_metrics.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  );

-- Usage Metrics: Users can insert metrics for their connectors
CREATE POLICY "Users can insert own metrics"
  ON usage_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = usage_metrics.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  );

-- Usage Metrics: Users can update metrics for their connectors
CREATE POLICY "Users can update own metrics"
  ON usage_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = usage_metrics.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM connectors
      WHERE connectors.id = usage_metrics.connector_id
      AND connectors.owner_id = auth.uid()::text
    )
  );