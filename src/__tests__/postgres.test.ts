import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { resumableStreamTests } from "./tests";
import { createTestingStream, streamToBuffer } from "../../testing-utils/testing-stream";
import { createResumableStreamContext } from "../postgres";
import { PGlite } from "@electric-sql/pglite";
import type { Sql } from "postgres";

/**
 * Creates a wrapper around PGlite that presents the same interface as the
 * `postgres` package's Sql type, so the existing postgres-adapters work unchanged.
 */
function createPgliteSqlProxy(pg: PGlite) {
  // Tagged template function matching postgres's sql`...` API
  const sqlProxy = (strings: TemplateStringsArray, ...values: unknown[]) => {
    // Convert tagged template to parameterized query string
    // e.g. sql`SELECT pg_notify(${ch}, ${msg})` → "SELECT pg_notify($1, $2)", [ch, msg]
    let query = "";
    for (let i = 0; i < strings.length; i++) {
      query += strings[i];
      if (i < values.length) {
        query += `$${i + 1}`;
      }
    }
    return pg.query(query, values as any[]).then((r) => r.rows);
  };

  // sql.unsafe(query, params) → pg.query(query, params).rows
  sqlProxy.unsafe = async (query: string, params?: unknown[]) => {
    const result = await pg.query(query, params as any[]);
    return result.rows;
  };

  // sql.listen(channel, callback)
  // PGlite's .listen() doesn't auto-quote channel identifiers containing
  // special chars (hyphens, colons). Use manual LISTEN + onNotification instead.
  sqlProxy.listen = async (
    channel: string,
    callback: (payload: string) => void
  ) => {
    const quoted = '"' + channel.replace(/"/g, '""') + '"';
    await pg.query(`LISTEN ${quoted}`);
    const handler = (ch: string, payload: string) => {
      if (ch === channel) {
        callback(payload);
      }
    };
    const removeHandler = pg.onNotification(handler);
    const unlisten = async () => {
      await pg.query(`UNLISTEN ${quoted}`);
      removeHandler();
    };
    return { state: undefined, unlisten };
  };

  // sql.end() → pg.close()
  sqlProxy.end = () => pg.close();

  return sqlProxy as unknown as Sql;
}

describe("postgres adapter", () => {
  let pg: PGlite;
  let sql: Sql;
  const tableName = "resumable_stream_state";

  beforeAll(async () => {
    pg = await PGlite.create();
    sql = createPgliteSqlProxy(pg);

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

  describe("large payload handling", () => {
    it("should handle buffered chunks exceeding pg_notify 8000 byte limit", async () => {
      const resume = createResumableStreamContext({
        waitUntil: () => Promise.resolve(),
        sql,
        tableName,
        keyPrefix: "test-large-payload-" + crypto.randomUUID(),
      });

      const { readable, writer } = createTestingStream();
      const stream = await resume.resumableStream("test", () => readable);

      // Write enough data to exceed 8000 bytes when buffered
      const largeChunk = "x".repeat(3000);
      writer.write(largeChunk);
      writer.write(largeChunk);
      writer.write(largeChunk); // 9000 bytes total - exceeds limit

      // Consumer joins and receives all buffered chunks via catch-up publish
      const stream2 = await resume.resumableStream("test", () => readable);

      writer.close();

      const result = await streamToBuffer(stream);
      const result2 = await streamToBuffer(stream2);

      expect(result).toEqual(largeChunk.repeat(3));
      expect(result2).toEqual(largeChunk.repeat(3));
    });

    it("should handle a single chunk exceeding pg_notify limit", async () => {
      const resume = createResumableStreamContext({
        waitUntil: () => Promise.resolve(),
        sql,
        tableName,
        keyPrefix: "test-single-large-" + crypto.randomUUID(),
      });

      const { readable, writer } = createTestingStream();
      const stream = await resume.resumableStream("test", () => readable);

      const hugeChunk = "A".repeat(10000);
      writer.write(hugeChunk);

      const stream2 = await resume.resumableStream("test", () => readable);

      writer.close();

      const result = await streamToBuffer(stream);
      const result2 = await streamToBuffer(stream2);

      expect(result).toEqual(hugeChunk);
      expect(result2).toEqual(hugeChunk);
    });
  });
});
