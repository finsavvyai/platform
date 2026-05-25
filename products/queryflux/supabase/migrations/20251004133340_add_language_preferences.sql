/*
  # Language Preferences System

  1. Changes to existing tables
    - Add `language` column to `user_settings` table
    - Add `language` column to `user_plugins` table for plugin-specific translations

  2. Security
    - RLS already enabled on user_settings
    - Users can only update their own language preferences
*/

-- Add language preference to user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'language'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN language text DEFAULT 'en';
  END IF;
END $$;

-- Add text direction preference (ltr/rtl)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'text_direction'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN text_direction text DEFAULT 'ltr';
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_settings_language ON user_settings(language);
