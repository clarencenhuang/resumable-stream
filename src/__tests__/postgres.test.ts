import { describe, beforeAll, afterAll, beforeEach } from "vitest";
import { resumableStreamTests } from "./tests";
import postgres from "postgres";

const POSTGRES_URL =
  process.env.POSTGRES_TEST_URL || "postgresql://postgres:postgres@localhost:5433/test";

describe("postgres adapter", () => {
  let sql: ReturnType<typeof postgres>;
  const tableName = "resumable_stream_state";

  beforeAll(async () => {
    // Connect to real Postgres database
    sql = postgres(POSTGRES_URL);

    // Create the required table schema
    await sql.unsafe(`DROP TABLE IF EXISTS ${tableName}`);
    await sql.unsafe(`
      CREATE TABLE ${tableName} (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at TIMESTAMPTZ
      )
    `);
  });

  afterAll(async () => {
    // Clean up table and close connection
    await sql.unsafe(`DROP TABLE IF EXISTS ${tableName}`);
    await sql.end();
  });

  beforeEach(async () => {
    // Clear the table before each test
    await sql.unsafe(`TRUNCATE TABLE ${tableName}`);
  });

  resumableStreamTests(() => {
    return {
      sql,
      tableName,
    };
  }, "postgres");
});
