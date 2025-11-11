# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript library that enables resumable streams for distributed systems. It wraps streams of strings (like SSE web responses) to allow clients to resume them after connection loss or enable multiple clients to follow along. The library is designed for serverless environments without sticky load balancing and uses Redis pubsub for coordination.

## Development Commands

```bash
# Run tests (with debug logging enabled)
pnpm test

# Run tests in watch mode
pnpm test:watch

# Build the library and generate documentation
pnpm build

# Format code with prettier
pnpm format

# Generate TypeDoc API documentation
pnpm docs
```

## Architecture

### Entry Points and Exports

The library has three export paths:
- **`resumable-stream`** (default): Exports from `src/redis.ts`, uses the `redis` npm package
- **`resumable-stream/redis`**: Explicit redis entry point
- **`resumable-stream/ioredis`**: Exports from `src/ioredis.ts`, uses the `ioredis` npm package

### Core Components

**`src/runtime.ts`** - Core implementation using the factory pattern:
- `createResumableStreamContextFactory()` - Factory function that takes Redis client defaults and returns a context creator
- `createResumableStream()` - Handles the idempotent API, determines if current request should be producer or consumer
- `createNewResumableStream()` - Creates the producer stream that buffers chunks and publishes to consumers
- `resumeStream()` - Creates a consumer stream that subscribes to receive chunks from the producer

**`src/types.ts`** - Type definitions:
- `ResumableStreamContext` - Main API interface with three methods: `resumableStream()`, `createNewResumableStream()`, `resumeExistingStream()`
- `Publisher` and `Subscriber` - Abstract interfaces compatible with both `redis` and `ioredis` packages

**`src/redis.ts` and `src/ioredis.ts`** - Redis client initialization:
- Each calls `createResumableStreamContextFactory()` with appropriate client defaults
- `ioredis.ts` uses adapter pattern (see `src/ioredis-adapters.ts`) to make ioredis API compatible with the Publisher/Subscriber interfaces

### Producer/Consumer Model

The library implements a **single producer, multiple consumer** pattern:

1. **First request** for a streamId increments a Redis counter and becomes the **producer**
2. The producer:
   - Creates the actual stream by calling the user's `makeStream()` function
   - Buffers all chunks in memory
   - Subscribes to a request channel to listen for new consumers
   - Publishes chunks to consumer-specific channels
   - Always completes the stream even if the original HTTP client disconnects
3. **Subsequent requests** for the same streamId become **consumers**:
   - Subscribe to a consumer-specific pubsub channel
   - Publish a request message to alert the producer
   - Receive buffered chunks (optionally skipping with `skipCharacters`) followed by real-time chunks
4. **After completion**, the sentinel key is set to "DONE" and expires after 24 hours

### Redis Key Patterns

- `{keyPrefix}:sentinel:{streamId}` - Counter for tracking number of clients, or "DONE" when stream completes
- `{keyPrefix}:request:{streamId}` - Pubsub channel where consumers publish requests to join
- `{keyPrefix}:chunk:{listenerId}` - Consumer-specific pubsub channels where producer publishes chunks

### Two API Styles

**Idempotent API** (recommended for simpler use cases):
- `resumableStream(streamId, makeStream, skipCharacters?)` - Creates or resumes automatically based on streamId state

**Explicit API** (for fine-grained control):
- `createNewResumableStream(streamId, makeStream)` - Explicitly creates a new stream (must be first for that streamId)
- `resumeExistingStream(streamId, skipCharacters?)` - Explicitly resumes an existing stream
- `hasExistingStream(streamId)` - Check stream state: null (doesn't exist), true (in progress), "DONE" (completed)

## Testing

Tests are written with Vitest. The shared test suite in `src/__tests__/tests.ts` contains the core functionality tests and is used by both redis and ioredis test files to ensure API compatibility between the two Redis client implementations.

Debug logging can be enabled by setting the `DEBUG` environment variable (automatically set by `pnpm test`).

## Build Configuration

- **`tsconfig.build.json`** - Build config that only includes the three entry point files (`index.ts`, `redis.ts`, `ioredis.ts`), excludes tests
- **Build outputs** to `dist/` directory with declarations and sourcemaps
- **TypeDoc** generates markdown documentation to `docs/` directory
- **Package exports** are defined in package.json with `typesVersions` for TypeScript module resolution
