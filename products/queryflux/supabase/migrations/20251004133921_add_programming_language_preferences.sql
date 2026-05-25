/*
  # Programming Language Preferences

  1. New Tables
    - `code_snippets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `description` (text)
      - `language` (text, programming language)
      - `code` (text, the actual code)
      - `tags` (text array)
      - `is_public` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `language_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `preferred_language` (text, default 'python')
      - `secondary_languages` (text array)
      - `code_style` (jsonb, style preferences)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Changes to existing tables
    - Add `preferred_code_language` to user_settings

  3. Security
    - Enable RLS on all tables
    - Users can only access their own snippets and preferences
    - Public snippets visible to all authenticated users
*/

-- Add preferred code language to user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'preferred_code_language'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN preferred_code_language text DEFAULT 'python';
  END IF;
END $$;

-- Code snippets table
CREATE TABLE IF NOT EXISTS code_snippets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  language text NOT NULL,
  code text NOT NULL,
  tags text[] DEFAULT '{}',
  is_public boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE code_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snippets"
  ON code_snippets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can insert own snippets"
  ON code_snippets
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own snippets"
  ON code_snippets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own snippets"
  ON code_snippets
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Language preferences table
CREATE TABLE IF NOT EXISTS language_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_language text DEFAULT 'python',
  secondary_languages text[] DEFAULT '{}',
  code_style jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE language_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON language_preferences
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON language_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON language_preferences
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_code_snippets_user_id ON code_snippets(user_id);
CREATE INDEX IF NOT EXISTS idx_code_snippets_language ON code_snippets(language);
CREATE INDEX IF NOT EXISTS idx_code_snippets_public ON code_snippets(is_public);
CREATE INDEX IF NOT EXISTS idx_language_preferences_user_id ON language_preferences(user_id);
