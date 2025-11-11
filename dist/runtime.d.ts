import { _Private, Publisher, Subscriber } from "./types";
import { CreateResumableStreamContextOptions } from "./types";
import { ResumableStreamContext } from "./types";
interface CreateResumableStreamContext {
    keyPrefix: string;
    waitUntil: (promise: Promise<unknown>) => void;
    subscriber: Subscriber;
    publisher: Publisher;
}
export declare function createResumableStreamContextFactory(defaults: _Private.RedisDefaults): (options: CreateResumableStreamContextOptions) => ResumableStreamContext;
export declare function resumeStream(ctx: CreateResumableStreamContext, streamId: string, skipCharacters?: number): Promise<ReadableStream<string> | null>;
export {};
