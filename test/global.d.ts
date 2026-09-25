/**
 * Minimal ambient declarations for the slice of node:test / node:assert/strict
 * used by this test suite. There's no @types/node here on purpose — this
 * project has no third-party devDependencies, and these two built-in modules
 * are the only ones the tests touch.
 */

declare module 'node:test' {
  export function test(name: string, fn: () => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  interface Assert {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => unknown, error?: Function, message?: string): void;
    fail(message?: string): never;
  }
  const assert: Assert;
  export default assert;
}
