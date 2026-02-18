"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPublisherAdapter = createPublisherAdapter;
exports.createSubscriberAdapter = createSubscriberAdapter;
/**
 * Hash a string to a fixed-length identifier that fits Postgres NOTIFY's 63-char limit.
 * Uses a simple hash function to convert long channel names to shorter ones.
 */
function hashChannel(channel) {
    // If already short enough, return as-is
    if (channel.length <= 63) {
        return channel;
    }
    // Create a hash of the channel name
    let hash = 0;
    for (let i = 0; i < channel.length; i++) {
        const char = channel.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to base36 and prepend with a prefix to avoid collisions
    const hashStr = Math.abs(hash).toString(36);
    // Take first part of original channel (up to 40 chars) + hash (up to 20 chars)
    const prefix = channel.substring(0, 40);
    return `${prefix}_${hashStr}`;
}
/**
 * Maximum payload size in bytes for pg_notify.
 * PostgreSQL has an 8000-byte hard limit; we use 7500 to leave a safety margin.
 */
const PG_NOTIFY_MAX_BYTES = 7500;
/**
 * Splits a message into chunks that each fit within pg_notify's payload limit.
 * Splits on character boundaries to avoid breaking multi-byte UTF-8 sequences.
 */
function splitMessage(message, maxBytes = PG_NOTIFY_MAX_BYTES) {
    if (Buffer.byteLength(message, "utf8") <= maxBytes) {
        return [message];
    }
    const chunks = [];
    let start = 0;
    while (start < message.length) {
        let low = 1;
        let high = message.length - start;
        // Binary search for the largest substring that fits in maxBytes
        while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (Buffer.byteLength(message.slice(start, start + mid), "utf8") <=
                maxBytes) {
                low = mid;
            }
            else {
                high = mid - 1;
            }
        }
        // Avoid splitting a surrogate pair
        const endIndex = start + low;
        if (endIndex < message.length) {
            const charCode = message.charCodeAt(endIndex);
            if (charCode >= 0xdc00 && charCode <= 0xdfff && low > 1) {
                low -= 1;
            }
        }
        chunks.push(message.slice(start, start + low));
        start += low;
    }
    return chunks;
}
/**
 * Creates a Publisher adapter for PostgreSQL using the postgres library.
 *
 * @param sql - A postgres Sql instance
 * @param tableName - Name of the table used for key-value storage
 * @returns A Publisher interface compatible with the resumable stream runtime
 */
function createPublisherAdapter(sql, tableName) {
    return {
        async connect() {
            // No-op: sql instance is already ready to use
        },
        async publish(channel, message) {
            // Hash the channel name to fit Postgres 63-char limit
            const hashedChannel = hashChannel(channel);
            // Split message if it exceeds pg_notify's 8000-byte payload limit.
            const chunks = splitMessage(message);
            if (chunks.length === 1) {
                await sql `SELECT pg_notify(${hashedChannel}, ${chunks[0]})`;
            }
            else {
                // Wrap split chunks in a transaction so all notifications are
                // delivered atomically at COMMIT. Without this, a consumer could
                // receive the first chunk's notification, trigger downstream logic
                // (like sending DONE), and miss the remaining chunks.
                // Use sql.begin() which properly pins to a single pooled connection.
                await sql.begin(async (tx) => {
                    for (const chunk of chunks) {
                        await tx `SELECT pg_notify(${hashedChannel}, ${chunk})`;
                    }
                });
            }
            // Postgres doesn't return listener count, return 0
            return 0;
        },
        async set(key, value, options) {
            const expiresAt = (options === null || options === void 0 ? void 0 : options.EX)
                ? new Date(Date.now() + options.EX * 1000).toISOString()
                : null;
            await sql.unsafe(`
        INSERT INTO ${tableName} (key, value, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (key) DO UPDATE
        SET value = $2, expires_at = $3
      `, [key, value, expiresAt]);
            return "OK";
        },
        async get(key) {
            const result = await sql.unsafe(`
        SELECT value FROM ${tableName}
        WHERE key = $1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `, [key]);
            return result.length > 0 ? result[0].value : null;
        },
        async incr(key) {
            try {
                // First, try to insert with value '1'
                const insertResult = await sql.unsafe(`
          INSERT INTO ${tableName} (key, value)
          VALUES ($1, '1')
          ON CONFLICT (key) DO NOTHING
          RETURNING value
        `, [key]);
                if (insertResult.length > 0) {
                    // Successfully inserted, return 1
                    return 1;
                }
                // Key already exists, try to increment
                // This will throw if value is not an integer (e.g., "DONE")
                const updateResult = await sql.unsafe(`
          UPDATE ${tableName}
          SET value = (value::integer + 1)::text
          WHERE key = $1
          RETURNING value
        `, [key]);
                return parseInt(updateResult[0].value, 10);
            }
            catch (error) {
                const errorString = String(error);
                // Check if the error is due to invalid integer cast (e.g., value is "DONE")
                if (errorString.includes("invalid input syntax for") ||
                    errorString.includes("invalid input syntax for type integer") ||
                    errorString.includes("ERR value is not an integer")) {
                    // Emulate Redis error for compatibility with runtime.ts incrOrDone()
                    throw new Error("ERR value is not an integer or out of range");
                }
                throw error;
            }
        },
    };
}
/**
 * Creates a Subscriber adapter for PostgreSQL using the postgres library.
 *
 * @param sql - A postgres Sql instance
 * @returns A Subscriber interface compatible with the resumable stream runtime
 */
function createSubscriberAdapter(sql) {
    const channelCallbacks = new Map();
    const channelMapping = new Map(); // original -> hashed
    const unsubscribeFunctions = new Map();
    return {
        async connect() {
            // No-op: sql instance is already ready to use
        },
        async subscribe(channel, callback) {
            // Store callback for this channel
            channelCallbacks.set(channel, callback);
            // Hash the channel name if needed
            const hashedChannel = hashChannel(channel);
            channelMapping.set(channel, hashedChannel);
            // Subscribe using postgres.listen()
            const { state, unlisten } = await sql.listen(hashedChannel, (payload) => {
                const originalCallback = channelCallbacks.get(channel);
                if (originalCallback) {
                    originalCallback(payload);
                }
            });
            // Store the unlisten function for cleanup
            unsubscribeFunctions.set(channel, unlisten);
        },
        async unsubscribe(channel) {
            // Remove callback
            channelCallbacks.delete(channel);
            // Call unlisten function if available
            const unlisten = unsubscribeFunctions.get(channel);
            if (unlisten) {
                await unlisten();
                unsubscribeFunctions.delete(channel);
            }
            // Clean up mapping
            channelMapping.delete(channel);
        },
    };
}
//# sourceMappingURL=postgres-adapters.js.map