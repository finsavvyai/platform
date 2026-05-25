-- Mock Supabase auth schema for local testing
CREATE SCHEMA IF NOT EXISTS auth;

-- Create mock auth functions
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN '00000000-0000-0000-0000-000000000000'::UUID; -- Return a dummy UUID
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
BEGIN
    RETURN 'authenticated';
END;
$$ LANGUAGE plpgsql;
