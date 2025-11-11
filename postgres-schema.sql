-- Table schema for Postgres adapter for resumable-stream
-- This table stores the key-value state needed for resumable stream coordination

CREATE UNLOGGED TABLE IF NOT EXISTS resumable_stream_state (
  -- Primary key for the state entry
  key TEXT PRIMARY KEY,

  -- Value stored (can be a counter like "1", "2", "3" or a sentinel value like "DONE")
  value TEXT NOT NULL,

  -- Optional expiration timestamp (set when using EX option in set())
  -- Entries with expired timestamps are treated as non-existent
  expires_at TIMESTAMPTZ
);

-- Index for efficient expiration queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_resumable_stream_expires
  ON resumable_stream_state(expires_at)
  WHERE expires_at IS NOT NULL;

-- Example usage:
--
-- import postgres from "postgres";
-- import { createResumableStreamContext } from "resumable-stream/postgres";
--
-- const sql = postgres(process.env.DATABASE_URL);
--
-- const ctx = createResumableStreamContext({
--   sql,
--   tableName: "resumable_stream_state",
--   waitUntil: null,
-- });
--
-- const stream = await ctx.resumableStream("my-stream-id", () => myDataStream());
