import { Redis } from "ioredis";
import { Publisher, Subscriber } from "./types";
/**
 * Creates a Subscriber adapter for a Redis client.
 * @param client - The Redis client to adapt
 * @returns A Subscriber interface compatible with the resumable stream
 */
export declare function createSubscriberAdapter(client: Redis): Subscriber;
/**
 * Creates a Publisher adapter for a Redis client.
 * @param client - The Redis client to adapt
 * @returns A Publisher interface compatible with the resumable stream
 */
export declare function createPublisherAdapter(client: Redis): Publisher;
