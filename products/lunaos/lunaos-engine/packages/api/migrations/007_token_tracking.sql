-- Add token tracking columns to executions table
ALTER TABLE executions ADD COLUMN input_tokens INTEGER DEFAULT 0;
ALTER TABLE executions ADD COLUMN output_tokens INTEGER DEFAULT 0;
ALTER TABLE executions ADD COLUMN estimated_cost REAL DEFAULT 0;
