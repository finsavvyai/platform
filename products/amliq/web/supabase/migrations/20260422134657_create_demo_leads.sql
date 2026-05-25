/*
  # Create demo_leads table

  1. New Tables
    - `demo_leads`
      - `id` (uuid, primary key)
      - `email` (text, required)
      - `company` (text)
      - `use_case` (text)
      - `source` (text) - which CTA captured the lead
      - `created_at` (timestamptz)
  2. Security
    - Enable RLS
    - Allow anonymous inserts only (public lead capture)
    - No read/update/delete for anon or authenticated (admin-only via service role)
*/

CREATE TABLE IF NOT EXISTS demo_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  company text DEFAULT '',
  use_case text DEFAULT '',
  source text DEFAULT 'hero',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE demo_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON demo_leads FOR INSERT
  TO anon
  WITH CHECK (
    length(email) > 3
    AND length(email) < 320
    AND email LIKE '%_@_%.__%'
  );

CREATE POLICY "Authenticated can submit a lead"
  ON demo_leads FOR INSERT
  TO authenticated
  WITH CHECK (
    length(email) > 3
    AND length(email) < 320
    AND email LIKE '%_@_%.__%'
  );
