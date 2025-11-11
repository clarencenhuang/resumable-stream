"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestingStream = createTestingStream;
exports.streamToBuffer = streamToBuffer;
function createTestingStream() {
    let controller = undefined;
    const buffer = [];
    const readable = new ReadableStream({
        start(c) {
            controller = c;
            if (buffer.length > 0) {
                for (const chunk of buffer) {
                    controller.enqueue(chunk);
                }
            }
        },
    });
    const writable = new WritableStream({
        write(chunk) {
            if (controller) {
                controller.enqueue(chunk);
            }
            buffer.push(chunk);
        },
        close() {
            controller.close();
        },
        abort(reason) {
            controller.error(reason);
        },
    });
    return {
        readable,
        writer: writable.getWriter(),
        buffer,
    };
}
const readers = new WeakMap();
async function streamToBuffer(stream, maxNReads) {
    if (stream === null) {
        throw new Error("Stream should not be null");
    }
    if (stream === undefined) {
        throw new Error("Stream should not be undefined");
    }
    const reader = (readers.has(stream) ? readers.get(stream) : stream.getReader());
    readers.set(stream, reader);
    const buffer = [];
    function timeout(ms) {
        return new Promise((resolve, reject) => setTimeout(() => reject(new Error(`Timeout with buffer ${JSON.stringify(buffer)}`)), ms));
    }
    let i = 0;
    while (true) {
        const { done, value } = await Promise.race([reader.read(), timeout(2000)]);
        if (!done) {
            buffer.push(value);
        }
        if (maxNReads && ++i === maxNReads) {
            break;
        }
        if (done) {
            break;
        }
    }
    return buffer.join("");
}
//# sourceMappingURL=testing-stream.js.map