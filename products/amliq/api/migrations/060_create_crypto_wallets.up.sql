-- Sanctioned crypto wallet addresses table.
-- Synced from OFAC, NBCTF, and other blockchain sanctions sources.
CREATE TABLE IF NOT EXISTS crypto_wallets (
    address      VARCHAR(128) NOT NULL,
    chain        VARCHAR(16)  NOT NULL,
    entity_id    VARCHAR(64)  DEFAULT '',
    list_id      VARCHAR(64)  NOT NULL,
    source       VARCHAR(128) NOT NULL,
    content_hash VARCHAR(64)  DEFAULT '',
    synced_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (address, chain)
);

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_list
    ON crypto_wallets (list_id);

CREATE INDEX IF NOT EXISTS idx_crypto_wallets_chain
    ON crypto_wallets (chain);

-- Track sync metadata per crypto source for ETag/fingerprint caching.
CREATE TABLE IF NOT EXISTS crypto_sync_meta (
    source_id     VARCHAR(64) PRIMARY KEY,
    content_hash  VARCHAR(64) NOT NULL DEFAULT '',
    last_count    INTEGER     NOT NULL DEFAULT 0,
    last_synced   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error    TEXT        DEFAULT ''
);
