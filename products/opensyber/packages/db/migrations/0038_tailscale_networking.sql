-- Add Tailscale zero-trust networking fields to instances
-- Stores the Tailscale device ID and CGNAT IP for mesh connectivity

ALTER TABLE instances ADD COLUMN tailscale_node_id TEXT;
ALTER TABLE instances ADD COLUMN tailscale_ip TEXT;
