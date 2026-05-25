/*
  # Admin read access for demo_leads

  1. Security
    - Add SELECT policy for authenticated users whose app_metadata.role = 'admin'
    - This lets the in-app admin panel list captured leads without exposing them to regular users
    - Public/anon users remain unable to read the table; inserts still allowed via existing policy
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'demo_leads'
      AND policyname = 'Admins can read all leads'
  ) THEN
    CREATE POLICY "Admins can read all leads"
      ON demo_leads FOR SELECT
      TO authenticated
      USING (
        coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      );
  END IF;
END $$;
