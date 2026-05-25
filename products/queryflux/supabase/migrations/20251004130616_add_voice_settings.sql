/*
  # Add Voice Assistant Settings

  1. Changes
    - Add user_settings table for storing voice preferences
    - Supports voice type, speed, pitch, volume, and auto-read settings
    - One settings record per user
  
  2. Security
    - Enable RLS
    - Users can only access their own settings
*/

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  voice_settings jsonb DEFAULT '{
    "voiceType": "female",
    "speed": 1.0,
    "pitch": 1.0,
    "volume": 1.0,
    "autoRead": true
  }'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON user_settings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
