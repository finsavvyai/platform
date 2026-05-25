#!/bin/bash
# PostgreSQL Database Initialization Script for QuantumBeam.io
# Creates multiple databases and sets up users

set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create databases
    CREATE DATABASE quantumbeam_test;
    CREATE DATABASE quantumbeam_staging;
    CREATE DATABASE quantumbeam_analytics;

    -- Create application users
    CREATE USER quantumbeam_api WITH PASSWORD 'qb_api_password_2024';
    CREATE USER quantumbeam_ml WITH PASSWORD 'qb_ml_password_2024';
    CREATE USER quantumbeam_quantum WITH PASSWORD 'qb_quantum_password_2024';
    CREATE USER quantumbeam_readonly WITH PASSWORD 'qb_readonly_password_2024';
    CREATE USER quantumbeam_backup WITH PASSWORD 'qb_backup_password_2024';

    -- Grant privileges on main database
    \c quantumbeam;

    -- Grant schema privileges
    GRANT CONNECT ON DATABASE quantumbeam TO quantumbeam_api;
    GRANT CONNECT ON DATABASE quantumbeam TO quantumbeam_ml;
    GRANT CONNECT ON DATABASE quantumbeam TO quantumbeam_quantum;
    GRANT CONNECT ON DATABASE quantumbeam TO quantumbeam_readonly;
    GRANT CONNECT ON DATABASE quantumbeam TO quantumbeam_backup;

    -- Create schemas with specific owners
    CREATE SCHEMA IF NOT EXISTS transactions AUTHORIZATION quantumbeam_api;
    CREATE SCHEMA IF NOT EXISTS analytics AUTHORIZATION quantumbeam_ml;
    CREATE SCHEMA IF NOT EXISTS quantum AUTHORIZATION quantumbeam_quantum;
    CREATE SCHEMA IF NOT EXISTS audit AUTHORIZATION postgres;
    CREATE SCHEMA IF NOT EXISTS partition_maintenance AUTHORIZATION postgres;

    -- Grant schema permissions
    GRANT USAGE ON SCHEMA transactions TO quantumbeam_api;
    GRANT CREATE ON SCHEMA transactions TO quantumbeam_api;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA transactions TO quantumbeam_api;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA transactions TO quantumbeam_api;

    GRANT USAGE ON SCHEMA analytics TO quantumbeam_ml;
    GRANT CREATE ON SCHEMA analytics TO quantumbeam_ml;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO quantumbeam_ml;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO quantumbeam_ml;

    GRANT USAGE ON SCHEMA quantum TO quantumbeam_quantum;
    GRANT CREATE ON SCHEMA quantum TO quantumbeam_quantum;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA quantum TO quantumbeam_quantum;
    GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA quantum TO quantumbeam_quantum;

    -- Grant read-only access
    GRANT USAGE ON SCHEMA transactions TO quantumbeam_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA transactions TO quantumbeam_readonly;
    GRANT USAGE ON SCHEMA analytics TO quantumbeam_readonly;
    GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO quantumbeam_readonly;

    -- Grant backup permissions
    GRANT USAGE ON SCHEMA transactions TO quantumbeam_backup;
    GRANT SELECT ON ALL TABLES IN SCHEMA transactions TO quantumbeam_backup;
    GRANT USAGE ON SCHEMA analytics TO quantumbeam_backup;
    GRANT SELECT ON ALL TABLES IN SCHEMA analytics TO quantumbeam_backup;

    -- Grant permissions on test database
    \c quantumbeam_test;
    GRANT CONNECT ON DATABASE quantumbeam_test TO quantumbeam_api;
    GRANT CONNECT ON DATABASE quantumbeam_test TO quantumbeam_ml;
    GRANT CONNECT ON DATABASE quantumbeam_test TO quantumbeam_quantum;
    GRANT ALL PRIVILEGES ON SCHEMA public TO quantumbeam_api;

    -- Grant permissions on staging database
    \c quantumbeam_staging;
    GRANT CONNECT ON DATABASE quantumbeam_staging TO quantumbeam_api;
    GRANT CONNECT ON DATABASE quantumbeam_staging TO quantumbeam_ml;
    GRANT CONNECT ON DATABASE quantumbeam_staging TO quantumbeam_quantum;
    GRANT ALL PRIVILEGES ON SCHEMA public TO quantumbeam_api;

    -- Grant permissions on analytics database
    \c quantumbeam_analytics;
    GRANT CONNECT ON DATABASE quantumbeam_analytics TO quantumbeam_ml;
    GRANT CONNECT ON DATABASE quantumbeam_analytics TO quantumbeam_readonly;
    GRANT ALL PRIVILEGES ON SCHEMA public TO quantumbeam_ml;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO quantumbeam_readonly;

    -- Set default privileges for future objects
    \c quantumbeam;
    ALTER DEFAULT PRIVILEGES IN SCHEMA transactions GRANT ALL ON TABLES TO quantumbeam_api;
    ALTER DEFAULT PRIVILEGES IN SCHEMA transactions GRANT ALL ON SEQUENCES TO quantumbeam_api;
    ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT ALL ON TABLES TO quantumbeam_ml;
    ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT ALL ON SEQUENCES TO quantumbeam_ml;
    ALTER DEFAULT PRIVILEGES IN SCHEMA quantum GRANT ALL ON TABLES TO quantumbeam_quantum;
    ALTER DEFAULT PRIVILEGES IN SCHEMA quantum GRANT ALL ON SEQUENCES TO quantumbeam_quantum;

    -- Create extension owner role
    CREATE ROLE extension_owner;
    GRANT extension_owner TO postgres;

    -- Create replication role for streaming replication
    CREATE ROLE replication_user WITH LOGIN REPLICATION PASSWORD 'repl_password_2024';

    -- Log database creation
    INSERT INTO pg_roles (rolname) VALUES ('quantumbeam_api') ON CONFLICT DO NOTHING;
    INSERT INTO pg_roles (rolname) VALUES ('quantumbeam_ml') ON CONFLICT DO NOTHING;
    INSERT INTO pg_roles (rolname) VALUES ('quantumbeam_quantum') ON CONFLICT DO NOTHING;

    -- Output confirmation
    SELECT 'Databases and users created successfully' AS status;

EOSQL

# Create .pgpass file for convenience
cat > /var/lib/postgresql/.pgpass <<EOF
localhost:5432:quantumbeam:postgres:$POSTGRES_PASSWORD
localhost:5432:quantumbeam:quantumbeam_api:qb_api_password_2024
localhost:5432:quantumbeam:quantumbeam_ml:qb_ml_password_2024
localhost:5432:quantumbeam:quantumbeam_quantum:qb_quantum_password_2024
localhost:5432:quantumbeam:quantumbeam_readonly:qb_readonly_password_2024
localhost:5432:quantumbeam:quantumbeam_backup:qb_backup_password_2024
EOF

chmod 600 /var/lib/postgresql/.pgpass
chown postgres:postgres /var/lib/postgresql/.pgpass

echo "Database initialization completed successfully!"
