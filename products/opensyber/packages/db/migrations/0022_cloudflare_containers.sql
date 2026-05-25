-- Migration: Replace Hetzner VM columns with Cloudflare Container columns
-- This migration was partially applied previously. All statements are now idempotent.

-- container_id and hostname columns already exist from partial run.
-- hetzner_server_id, ipv4, ipv6 columns already dropped from partial run.

-- Only ensure the index exists
CREATE INDEX IF NOT EXISTS idx_instances_container_id ON instances(container_id);
