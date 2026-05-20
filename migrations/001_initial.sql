-- Mnemo initial schema.
-- Requires the pgvector extension (provided by the ankane/pgvector image).

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============== users ===============
CREATE TABLE IF NOT EXISTS users (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    sui_address     VARCHAR(66)     UNIQUE NOT NULL,
    google_sub      VARCHAR(255)    UNIQUE,
    proxy_token     VARCHAR(64)     UNIQUE NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- =============== namespaces ===============
CREATE TABLE IF NOT EXISTS namespaces (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sui_object_id   VARCHAR(66)     NOT NULL,
    name            VARCHAR(120)    NOT NULL,
    is_default      BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS namespaces_user ON namespaces (user_id);

-- =============== provider_keys ===============
-- One row per (user, provider). The actual key material is encrypted client-side
-- via Seal and stored as a Walrus blob; we only keep the blob ID and policy ref.
CREATE TABLE IF NOT EXISTS provider_keys (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            VARCHAR(40)     NOT NULL,
    walrus_blob_id      VARCHAR(120)    NOT NULL,
    seal_policy_id      VARCHAR(66)     NOT NULL,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

-- =============== entries ===============
-- One row per captured (prompt, response) pair. The encrypted payload lives on
-- Walrus; we keep the blob ID, the embedding vector, and a short plaintext
-- preview for fast result rendering (privacy trade-off, documented in threat model).
CREATE TABLE IF NOT EXISTS entries (
    id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    namespace_id        UUID            NOT NULL REFERENCES namespaces(id) ON DELETE CASCADE,
    walrus_blob_id      VARCHAR(120),
    embedding           vector(1536),
    model               VARCHAR(80),
    preview             VARCHAR(240),
    token_input         INTEGER,
    token_output        INTEGER,
    ts                  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS entries_user_ns_ts
    ON entries (user_id, namespace_id, ts DESC);

CREATE INDEX IF NOT EXISTS entries_embedding_hnsw
    ON entries USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS entries_active
    ON entries (user_id, namespace_id)
    WHERE deleted_at IS NULL;
