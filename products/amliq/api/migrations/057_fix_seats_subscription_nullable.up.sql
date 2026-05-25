ALTER TABLE seats ALTER COLUMN subscription_id DROP NOT NULL;
ALTER TABLE seats ALTER COLUMN subscription_id SET DEFAULT '';
ALTER TABLE seats DROP CONSTRAINT IF EXISTS seats_subscription_id_fkey;
