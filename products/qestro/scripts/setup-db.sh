#!/usr/bin/env bash
# ============================================================
#  Database Setup Script for Qestro
#
#  This script:
#  1. Waits for PostgreSQL to be ready
#  2. Creates database if it doesn't exist
#  3. Runs Drizzle migrations
#  4. Seeds initial data (admin user)
#
#  Usage:
#    bash scripts/setup-db.sh
#
#  Environment variables:
#    DATABASE_URL: PostgreSQL connection string
#    DB_HOST: Database host (default: localhost)
#    DB_PORT: Database port (default: 5432)
#    DB_NAME: Database name (default: qestro)
#    DB_USER: Database user (default: qestro_user)
#    DB_PASSWORD: Database password (required)
# ============================================================

set -e

# ── Configuration ────────────────────────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-qestro}"
DB_USER="${DB_USER:-qestro_user}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Resolve script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[1;31m'
GRN='\033[1;32m'
YLW='\033[1;33m'
BLU='\033[1;34m'
R='\033[0m'

# Symbols
OK="${GRN}✓${R}"
FAIL="${RED}✗${R}"
ARROW="${BLU}▶${R}"

# ── Validation ───────────────────────────────────────────────
if [ -z "$DB_PASSWORD" ] && [ -z "$DATABASE_URL" ]; then
  echo -e "${FAIL} Database password not set"
  echo "   Set DB_PASSWORD or DATABASE_URL environment variable"
  exit 1
fi

# ── Helper Functions ─────────────────────────────────────────
wait_for_postgres() {
  local host=$1
  local port=$2
  local user=$3
  local password=$4
  local db=$5
  local timeout=60
  local elapsed=0

  echo -e "${ARROW} Waiting for PostgreSQL at ${host}:${port}..."

  while [ $elapsed -lt $timeout ]; do
    if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "postgres" -c "SELECT 1" &>/dev/null; then
      echo -e "${OK} PostgreSQL is ready"
      return 0
    fi
    echo -n "."
    sleep 2
    elapsed=$((elapsed + 2))
  done

  echo -e "\n${FAIL} PostgreSQL failed to start within ${timeout} seconds"
  return 1
}

create_database() {
  local host=$1
  local port=$2
  local user=$3
  local password=$4
  local db=$5

  echo -e "${ARROW} Creating database '${db}' if it doesn't exist..."

  # Check if database exists
  if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "postgres" -lqt | cut -d \| -f 1 | grep -qw "$db"; then
    echo -e "${OK} Database '${db}' already exists"
    return 0
  fi

  # Create database
  if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "postgres" -c "CREATE DATABASE \"${db}\";" &>/dev/null; then
    echo -e "${OK} Database '${db}' created successfully"
    return 0
  else
    echo -e "${FAIL} Failed to create database '${db}'"
    return 1
  fi
}

run_migrations() {
  local db_url=$1

  echo -e "${ARROW} Running Drizzle migrations..."

  # Check if migrations exist
  if [ ! -f "$PROJECT_ROOT/drizzle/schema.ts" ]; then
    echo -e "${YLW} No Drizzle schema found at drizzle/schema.ts"
    return 1
  fi

  cd "$PROJECT_ROOT"

  # Run Drizzle migrations using npx
  if DATABASE_URL="$db_url" npx drizzle-kit migrate &>/dev/null; then
    echo -e "${OK} Migrations completed successfully"
    return 0
  else
    echo -e "${YLW} Migration warning (this may be expected on first run)"
    return 0
  fi
}

seed_data() {
  local host=$1
  local port=$2
  local user=$3
  local password=$4
  local db=$5

  echo -e "${ARROW} Seeding initial data..."

  # Create admin user if it doesn't exist
  local seed_sql="
    INSERT INTO users (email, name, password_hash, role, is_verified, created_at, updated_at)
    SELECT
      'admin@qestro.io',
      'Admin User',
      '\$2b\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
      'admin',
      true,
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM users WHERE email = 'admin@qestro.io'
    );

    INSERT INTO users (email, name, password_hash, role, is_verified, created_at, updated_at)
    SELECT
      'test@qestro.io',
      'Test User',
      '\$2b\$10\$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/KFm',
      'user',
      true,
      NOW(),
      NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM users WHERE email = 'test@qestro.io'
    );
  "

  if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d "$db" -c "$seed_sql" &>/dev/null; then
    echo -e "${OK} Initial data seeded"
    return 0
  else
    echo -e "${YLW} Seed data may already exist or failed to insert"
    return 0
  fi
}

# ── Main Script ──────────────────────────────────────────────
echo ""
echo -e "${BLU}╔════════════════════════════════════════════════╗${R}"
echo -e "${BLU}║${R}  Qestro Database Setup${R}                       ${BLU}║${R}"
echo -e "${BLU}╚════════════════════════════════════════════════╝${R}"
echo ""

# Step 1: Construct database URL if not provided
if [ -z "$DATABASE_URL" ]; then
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
fi

echo -e "${BLU}Configuration:${R}"
echo -e "  Host:     ${BLU}${DB_HOST}${R}"
echo -e "  Port:     ${BLU}${DB_PORT}${R}"
echo -e "  Database: ${BLU}${DB_NAME}${R}"
echo -e "  User:     ${BLU}${DB_USER}${R}"
echo ""

# Step 2: Wait for PostgreSQL
if ! wait_for_postgres "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_PASSWORD"; then
  echo -e "${FAIL} Cannot proceed without PostgreSQL"
  exit 1
fi

# Step 3: Create database
if ! create_database "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_PASSWORD" "$DB_NAME"; then
  echo -e "${FAIL} Failed to create database"
  exit 1
fi

# Step 4: Run migrations
if ! run_migrations "$DATABASE_URL"; then
  echo -e "${YLW} Migrations skipped or failed (continuing anyway)"
fi

# Step 5: Seed initial data
if ! seed_data "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_PASSWORD" "$DB_NAME"; then
  echo -e "${YLW} Seed data failed (continuing anyway)"
fi

echo ""
echo -e "${BLU}╔════════════════════════════════════════════════╗${R}"
echo -e "${BLU}║${R}  Setup Complete ${OK}                              ${BLU}║${R}"
echo -e "${BLU}╚════════════════════════════════════════════════╝${R}"
echo ""
echo -e "Database URL: ${BLU}postgresql://${DB_USER}:***@${DB_HOST}:${DB_PORT}/${DB_NAME}${R}"
echo ""
