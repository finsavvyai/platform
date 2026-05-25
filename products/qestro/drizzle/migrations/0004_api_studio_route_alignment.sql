-- Align existing platform API Studio tables with the active Worker routes.
-- Safe for databases where these columns were already created by newer migrations.

ALTER TABLE api_testing_environments ADD COLUMN project_id TEXT;
ALTER TABLE api_testing_history ADD COLUMN collection_id TEXT;
ALTER TABLE api_testing_history ADD COLUMN response_status_text TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_api_testing_environments_project_id
  ON api_testing_environments(project_id);
