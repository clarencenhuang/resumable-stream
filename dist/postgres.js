"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPgResumableStreamContext = exports.createResumableStreamContextFactory = exports.resumeStream = void 0;
exports.createResumableStreamContext = createResumableStreamContext;
const runtime_1 = require("./runtime");
const postgres_adapters_1 = require("./postgres-adapters");
__exportStar(require("./types"), exports);
var runtime_2 = require("./runtime");
Object.defineProperty(exports, "resumeStream", { enumerable: true, get: function () { return runtime_2.resumeStream; } });
Object.defineProperty(exports, "createResumableStreamContextFactory", { enumerable: true, get: function () { return runtime_2.createResumableStreamContextFactory; } });
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
function createResumableStreamContext(options) {
    const { sql, tableName } = options, restOptions = __rest(options, ["sql", "tableName"]);
    // Create adapters using the provided sql instance and table name
    const publisher = (0, postgres_adapters_1.createPublisherAdapter)(sql, tableName);
    const subscriber = (0, postgres_adapters_1.createSubscriberAdapter)(sql);
    // Create a factory with no-op defaults (we provide publisher/subscriber directly)
    const factory = (0, runtime_1.createResumableStreamContextFactory)({
        publisher: () => publisher,
        subscriber: () => subscriber,
    });
    // Call the factory with the publisher and subscriber
    return factory(Object.assign(Object.assign({}, restOptions), { publisher,
        subscriber }));
}
/**
 * Alias for createResumableStreamContext (Postgres-backed).
 * @see createResumableStreamContext
 */
exports.createPgResumableStreamContext = createResumableStreamContext;
//# sourceMappingURL=postgres.js.map