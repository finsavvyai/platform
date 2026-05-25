-- Remove development seed user from production databases (safe if row absent).
DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE email = 'test@queryflux.dev');
DELETE FROM users WHERE email = 'test@queryflux.dev';
