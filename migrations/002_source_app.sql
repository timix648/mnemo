-- Adds source_app classification to entries.
-- Captures which AI client (Cursor, BoltAI, Continue, etc.) made the call,
-- so the chat-browser UI can render "From Cursor" labels and filter by source.
-- Both columns nullable so pre-existing rows survive the migration.
ALTER TABLE entries
  ADD COLUMN IF NOT EXISTS source_app TEXT,
  ADD COLUMN IF NOT EXISTS source_app_raw TEXT;

-- Optional: index for filtering by source_app in the chats UI.
-- Skipping for now since cardinality is low (5-10 known apps); add later if needed.
