import type { Sql } from "postgres";
import { Publisher, Subscriber } from "./types";

/**
 * Hash a string to a fixed-length identifier that fits Postgres NOTIFY's 63-char limit.
 * Uses a simple hash function to convert long channel names to shorter ones.
 */
function hashChannel(channel: string): string {
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
 * Creates a Publisher adapter for PostgreSQL using the postgres library.
 *
 * @param sql - A postgres Sql instance
 * @param tableName - Name of the table used for key-value storage
 * @returns A Publisher interface compatible with the resumable stream runtime
 */
export function createPublisherAdapter(sql: Sql, tableName: string): Publisher {
  return {
    async connect() {
      // No-op: sql instance is already ready to use
    },
    async publish(channel: string, message: string): Promise<number> {
      // Hash the channel name to fit Postgres 63-char limit
      const hashedChannel = hashChannel(channel);

      // Use NOTIFY to send message to channel
      await sql`SELECT pg_notify(${hashedChannel}, ${message})`;
      // Postgres doesn't return listener count, return 0
      return 0;
    },
    async set(
      key: string,
      value: string,
      options?: { EX?: number }
    ): Promise<string | unknown> {
      const expiresAt = options?.EX
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
    async get(key: string): Promise<string | number | null> {
      const result = await sql.unsafe(`
        SELECT value FROM ${tableName}
        WHERE key = $1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      `, [key]);
      return result.length > 0 ? result[0].value : null;
    },
    async incr(key: string): Promise<number> {
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
      } catch (error) {
        const errorString = String(error);
        // Check if the error is due to invalid integer cast (e.g., value is "DONE")
        if (
          errorString.includes("invalid input syntax for") ||
          errorString.includes("invalid input syntax for type integer") ||
          errorString.includes("ERR value is not an integer")
        ) {
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
export function createSubscriberAdapter(sql: Sql): Subscriber {
  const channelCallbacks = new Map<string, (message: string) => void>();
  const channelMapping = new Map<string, string>(); // original -> hashed
  const unsubscribeFunctions = new Map<string, () => Promise<void>>();

  return {
    async connect() {
      // No-op: sql instance is already ready to use
    },
    async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
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
    async unsubscribe(channel: string): Promise<void> {
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
