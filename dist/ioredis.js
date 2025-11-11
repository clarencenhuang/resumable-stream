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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createResumableStreamContext = exports.createResumableStreamContextFactory = exports.resumeStream = void 0;
const get_redis_url_1 = require("./get-redis-url");
const ioredis_1 = require("ioredis");
const runtime_1 = require("./runtime");
const ioredis_adapters_1 = require("./ioredis-adapters");
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
 * @param options.keyPrefix - The prefix for the keys used by the resumable streams. Defaults to `resumable-stream`.
 * @param options.waitUntil - A function that takes a promise and ensures that the current program stays alive until the promise is resolved.
 * @param options.subscriber - A pubsub subscriber. Designed to be compatible with clients from the `redis` package. If not provided, a new client will be created based on REDIS_URL or KV_URL environment variables.
 * @param options.publisher - A pubsub publisher. Designed to be compatible with clients from the `redis` package. If not provided, a new client will be created based on REDIS_URL or KV_URL environment variables.
 * @returns A resumable stream context.
 */
exports.createResumableStreamContext = (0, runtime_1.createResumableStreamContextFactory)({
    publisher: () => (0, ioredis_adapters_1.createPublisherAdapter)(new ioredis_1.Redis((0, get_redis_url_1.getRedisUrl)())),
    subscriber: () => (0, ioredis_adapters_1.createSubscriberAdapter)(new ioredis_1.Redis((0, get_redis_url_1.getRedisUrl)())),
});
//# sourceMappingURL=ioredis.js.map