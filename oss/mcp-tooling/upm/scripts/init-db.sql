-- Initialize UDP database with required extensions and settings

-- Create database if it doesn't exist (for PostgreSQL)
-- This file is used by Docker during initial setup

-- Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application user if not exists
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE  rolname = 'udp_user') THEN
      
      CREATE ROLE udp_user LOGIN PASSWORD 'udp_password';
   END IF;
END
$do$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE udp_dev TO udp_user;
GRANT ALL PRIVILEGES ON SCHEMA public TO udp_user;

-- Set default permissions for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO udp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO udp_user;