-- Seed: Session Integrity skill (powered by TokenForge)
-- Device-bound ECDSA P-256 session security

INSERT OR IGNORE INTO skills (id, slug, name, description, category, author_id, current_version, verification_status, verified_at, install_count, rating_avg, rating_count, tier, price_cents, manifest, is_featured, is_certified, created_at)
VALUES
  ('sk_session_integrity', 'session-integrity', 'Session Integrity', 'Powered by TokenForge. Cryptographically binds every developer session to their device using ECDSA P-256 keypairs. A stolen authentication cookie cannot make a single request without the device-bound private key.', 'security', 'opensyber', '1.0.0', 'approved', datetime('now'), 0, 0, 0, 'free', 0, '{"name":"Session Integrity","slug":"session-integrity","version":"1.0.0","description":"Device-bound ECDSA P-256 session security","entrypoint":"index.js","permissions":{"network":[],"filesystem":["./"],"env":[]},"author":"OpenSyber"}', 1, 1, datetime('now'));
