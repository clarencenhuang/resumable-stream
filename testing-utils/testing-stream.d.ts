export declare function createTestingStream(): {
    readable: ReadableStream<string>;
    writer: WritableStreamDefaultWriter<string>;
    buffer: string[];
};
export declare function streamToBuffer(stream: ReadableStream<string> | null | undefined, maxNReads?: number): Promise<string>;
