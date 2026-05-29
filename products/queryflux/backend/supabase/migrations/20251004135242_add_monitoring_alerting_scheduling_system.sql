/*
  # Monitoring, Alerting & Scheduling System

  1. New Tables
    - `monitors`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `connection_id` (uuid, references connections)
      - `name` (text)
      - `description` (text)
      - `monitor_type` (text: 'query', 'connection', 'performance', 'disk_space', 'table_size')
      - `query` (text, SQL query to monitor)
      - `check_interval` (integer, minutes)
      - `threshold_config` (jsonb, threshold rules)
      - `is_active` (boolean)
      - `last_checked_at` (timestamptz)
      - `last_status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `alert_rules`
      - `id` (uuid, primary key)
      - `monitor_id` (uuid, references monitors)
      - `name` (text)
      - `condition` (text: 'greater_than', 'less_than', 'equals', 'contains', 'changes')
      - `threshold_value` (text)
      - `severity` (text: 'info', 'warning', 'error', 'critical')
      - `is_active` (boolean)
      - `created_at` (timestamptz)

    - `notification_channels`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `channel_type` (text: 'email', 'slack', 'teams', 'discord', 'webhook', 'sms')
      - `config` (jsonb, channel-specific config)
      - `is_active` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `alert_notifications`
      - `id` (uuid, primary key)
      - `alert_rule_id` (uuid, references alert_rules)
      - `notification_channel_id` (uuid, references notification_channels)
      - `created_at` (timestamptz)

    - `alert_history`
      - `id` (uuid, primary key)
      - `monitor_id` (uuid, references monitors)
      - `alert_rule_id` (uuid, references alert_rules)
      - `severity` (text)
      - `message` (text)
      - `details` (jsonb)
      - `notified_channels` (jsonb)
      - `is_acknowledged` (boolean)
      - `acknowledged_by` (uuid, references auth.users)
      - `acknowledged_at` (timestamptz)
      - `created_at` (timestamptz)

    - `scheduled_queries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `connection_id` (uuid, references connections)
      - `name` (text)
      - `description` (text)
      - `query` (text)
      - `schedule_cron` (text, cron expression)
      - `schedule_timezone` (text)
      - `is_active` (boolean)
      - `output_format` (text: 'json', 'csv', 'excel')
      - `notification_channels` (jsonb)
      - `last_run_at` (timestamptz)
      - `next_run_at` (timestamptz)
      - `last_status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `scheduled_query_runs`
      - `id` (uuid, primary key)
      - `scheduled_query_id` (uuid, references scheduled_queries)
      - `status` (text: 'pending', 'running', 'success', 'failed')
      - `started_at` (timestamptz)
      - `completed_at` (timestamptz)
      - `duration_ms` (integer)
      - `row_count` (integer)
      - `error_message` (text)
      - `result_data` (jsonb)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can only access their own monitors and alerts
*/

-- Monitors table
CREATE TABLE IF NOT EXISTS monitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  monitor_type text DEFAULT 'query' CHECK (monitor_type IN ('query', 'connection', 'performance', 'disk_space', 'table_size', 'row_count')),
  query text,
  check_interval integer DEFAULT 5,
  threshold_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_checked_at timestamptz,
  last_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own monitors"
  ON monitors FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own monitors"
  ON monitors FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own monitors"
  ON monitors FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own monitors"
  ON monitors FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Alert Rules table
CREATE TABLE IF NOT EXISTS alert_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  name text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('greater_than', 'less_than', 'equals', 'not_equals', 'contains', 'not_contains', 'changes', 'no_data')),
  threshold_value text,
  severity text DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert rules"
  ON alert_rules FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monitors
      WHERE monitors.id = alert_rules.monitor_id
      AND monitors.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own alert rules"
  ON alert_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM monitors
      WHERE monitors.id = alert_rules.monitor_id
      AND monitors.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own alert rules"
  ON alert_rules FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monitors
      WHERE monitors.id = alert_rules.monitor_id
      AND monitors.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own alert rules"
  ON alert_rules FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monitors
      WHERE monitors.id = alert_rules.monitor_id
      AND monitors.user_id = auth.uid()
    )
  );

-- Notification Channels table
CREATE TABLE IF NOT EXISTS notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  channel_type text NOT NULL CHECK (channel_type IN ('email', 'slack', 'teams', 'discord', 'webhook', 'sms', 'telegram', 'pagerduty')),
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification channels"
  ON notification_channels FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification channels"
  ON notification_channels FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notification channels"
  ON notification_channels FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notification channels"
  ON notification_channels FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Alert Notifications (junction table)
CREATE TABLE IF NOT EXISTS alert_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  notification_channel_id uuid NOT NULL REFERENCES notification_channels(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(alert_rule_id, notification_channel_id)
);

ALTER TABLE alert_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert notifications"
  ON alert_notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notification_channels
      WHERE notification_channels.id = alert_notifications.notification_channel_id
      AND notification_channels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own alert notifications"
  ON alert_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM notification_channels
      WHERE notification_channels.id = alert_notifications.notification_channel_id
      AND notification_channels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own alert notifications"
  ON alert_notifications FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM notification_channels
      WHERE notification_channels.id = alert_notifications.notification_channel_id
      AND notification_channels.user_id = auth.uid()
    )
  );

-- Alert History table
CREATE TABLE IF NOT EXISTS alert_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id uuid NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  alert_rule_id uuid REFERENCES alert_rules(id) ON DELETE SET NULL,
  severity text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  notified_channels jsonb DEFAULT '[]'::jsonb,
  is_acknowledged boolean DEFAULT false,
  acknowledged_by uuid REFERENCES auth.users(id),
  acknowledged_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE alert_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert history"
  ON alert_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monitors
      WHERE monitors.id = alert_history.monitor_id
      AND monitors.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own alert history"
  ON alert_history FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM monitors
      WHERE monitors.id = alert_history.monitor_id
      AND monitors.user_id = auth.uid()
    )
  );

-- Scheduled Queries table
CREATE TABLE IF NOT EXISTS scheduled_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  query text NOT NULL,
  schedule_cron text NOT NULL,
  schedule_timezone text DEFAULT 'UTC',
  is_active boolean DEFAULT true,
  output_format text DEFAULT 'json' CHECK (output_format IN ('json', 'csv', 'excel', 'pdf')),
  notification_channels jsonb DEFAULT '[]'::jsonb,
  last_run_at timestamptz,
  next_run_at timestamptz,
  last_status text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled queries"
  ON scheduled_queries FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled queries"
  ON scheduled_queries FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled queries"
  ON scheduled_queries FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled queries"
  ON scheduled_queries FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Scheduled Query Runs table
CREATE TABLE IF NOT EXISTS scheduled_query_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_query_id uuid NOT NULL REFERENCES scheduled_queries(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed')),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  duration_ms integer,
  row_count integer,
  error_message text,
  result_data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE scheduled_query_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scheduled query runs"
  ON scheduled_query_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM scheduled_queries
      WHERE scheduled_queries.id = scheduled_query_runs.scheduled_query_id
      AND scheduled_queries.user_id = auth.uid()
    )
  );

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_connection_id ON monitors(connection_id);
CREATE INDEX IF NOT EXISTS idx_monitors_is_active ON monitors(is_active);
CREATE INDEX IF NOT EXISTS idx_alert_rules_monitor_id ON alert_rules(monitor_id);
CREATE INDEX IF NOT EXISTS idx_notification_channels_user_id ON notification_channels(user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_monitor_id ON alert_history(monitor_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_created_at ON alert_history(created_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_queries_user_id ON scheduled_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_queries_next_run ON scheduled_queries(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_query_runs_query_id ON scheduled_query_runs(scheduled_query_id);
