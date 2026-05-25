-- Initialize UPM.Plus database
-- This script is run when the PostgreSQL container starts

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE upmplus'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'upmplus')\gexec

-- Connect to the database
\c upmplus;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create indexes for better performance (will be created by Alembic migrations)
-- This is just a placeholder for any additional setup needed