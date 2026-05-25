-- HMAC signing secret per webhook. Sent as X-ClawPipe-Signature: sha256=<hex>
-- so receivers can verify payload authenticity.

ALTER TABLE webhooks ADD COLUMN secret TEXT;
