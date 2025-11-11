import type { Sql } from "postgres";
import { Publisher, Subscriber } from "./types";
/**
 * Creates a Publisher adapter for PostgreSQL using the postgres library.
 *
 * @param sql - A postgres Sql instance
 * @param tableName - Name of the table used for key-value storage
 * @returns A Publisher interface compatible with the resumable stream runtime
 */
export declare function createPublisherAdapter(sql: Sql, tableName: string): Publisher;
/**
 * Creates a Subscriber adapter for PostgreSQL using the postgres library.
 *
 * @param sql - A postgres Sql instance
 * @returns A Subscriber interface compatible with the resumable stream runtime
 */
export declare function createSubscriberAdapter(sql: Sql): Subscriber;
