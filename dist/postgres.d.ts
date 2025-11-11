import type { Sql } from "postgres";
import type { CreateResumableStreamContextOptions, ResumableStreamContext } from "./types";
export * from "./types";
export { resumeStream, createResumableStreamContextFactory } from "./runtime";
/**
 * Options for creating a Postgres-backed resumable stream context.
 */
export interface PostgresCreateResumableStreamContextOptions extends Omit<CreateResumableStreamContextOptions, "subscriber" | "publisher"> {
    /**
     * A postgres Sql instance from the `postgres` package.
     */
    sql: Sql;
    /**
     * The name of the table used for key-value storage.
     * The table must have the following schema:
     * - key TEXT PRIMARY KEY
     * - value TEXT NOT NULL
     * - expires_at TIMESTAMPTZ
     */
    tableName: string;
}
/**
 * Creates a global context for resumable streams from which you can create resumable streams.
 *
 * Call `resumableStream` on the returned context object to create a stream.
 *
 * @param options - The context options.
 * @param options.sql - A postgres Sql instance from the `postgres` package.
 * @param options.tableName - The name of the table used for key-value storage.
 * @param options.keyPrefix - The prefix for the keys used by the resumable streams. Defaults to `resumable-stream`.
 * @param options.waitUntil - A function that takes a promise and ensures that the current program stays alive until the promise is resolved.
 * @returns A resumable stream context.
 *
 * @example
 * ```typescript
 * import postgres from "postgres";
 * import { createResumableStreamContext } from "resumable-stream/postgres";
 *
 * const sql = postgres(process.env.DATABASE_URL);
 *
 * // Create the required table (one-time setup):
 * await sql`
 *   CREATE TABLE IF NOT EXISTS resumable_stream_state (
 *     key TEXT PRIMARY KEY,
 *     value TEXT NOT NULL,
 *     expires_at TIMESTAMPTZ
 *   )
 * `;
 *
 * const ctx = createResumableStreamContext({
 *   sql,
 *   tableName: "resumable_stream_state",
 *   waitUntil: null,
 * });
 *
 * // Use the context to create resumable streams
 * const stream = await ctx.resumableStream(
 *   "my-stream-id",
 *   () => myDataStream()
 * );
 * ```
 */
export declare function createResumableStreamContext(options: PostgresCreateResumableStreamContextOptions): ResumableStreamContext;
/**
 * Alias for createResumableStreamContext (Postgres-backed).
 * @see createResumableStreamContext
 */
export declare const createPgResumableStreamContext: typeof createResumableStreamContext;
