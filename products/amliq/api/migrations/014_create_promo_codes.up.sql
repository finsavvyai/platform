CREATE TABLE promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent >= 0 AND discount_percent <= 100),
    duration_months INTEGER NOT NULL DEFAULT 0,
    valid_products JSONB NOT NULL DEFAULT '[]',
    expires_at TIMESTAMPTZ,
    max_redemptions INTEGER DEFAULT 0,
    current_redemptions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_promo_code ON promo_codes(code);
INSERT INTO promo_codes (id, code, discount_percent, duration_months, valid_products, max_redemptions)
VALUES ('promo_aegis_free', 'AEGIS_FREE', 100, 0, '["api","dashboard","sdk","iframe","dataset"]', 0);
