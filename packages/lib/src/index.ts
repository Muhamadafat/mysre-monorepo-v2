
// Client-safe exports only. Server-only code (Prisma, JWT session auth,
// xAPI helpers that touch the DB) lives in '@sre-monorepo/lib/server'
// so it never gets pulled into a Client Component's browser bundle.
export { default as eventBus } from './event-bus';

export * from './xapi-client';