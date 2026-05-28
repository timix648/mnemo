-- 003_provider_key_material.sql
-- Bring-your-own-key: store the actual provider API key so the proxy can use
-- each user's own key instead of one shared dev key.
--
-- TESTNET BETA NOTE: key_material holds the key as provided. For a closed beta
-- among known testers this is acceptable. BEFORE opening wider / mainnet, this
-- must become Seal-encrypted ciphertext (the deferred Use-#2 feature) so the
-- server never holds plaintext keys. The column name is deliberately generic so
-- that upgrade is a value-format change, not a schema change.

ALTER TABLE provider_keys
    ADD COLUMN IF NOT EXISTS key_material TEXT;

-- The old walrus_blob_id / seal_policy_id columns are now unused for the
-- functional path (they held placeholder strings). Make them nullable so new
-- rows don't need them. (Left in place to avoid breaking existing rows.)
ALTER TABLE provider_keys ALTER COLUMN walrus_blob_id DROP NOT NULL;
ALTER TABLE provider_keys ALTER COLUMN seal_policy_id DROP NOT NULL;
