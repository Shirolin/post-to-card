/**
 * The registry and runner every tier shares.
 *
 * Each tier file used to carry its own copy of both, and the copies had drifted:
 * tiers 1-4 reported `err.message`, the five `tier_*.test.ts` files reported
 * `err.stack || err.message`, so the same failure printed differently depending
 * on which tier raised it. One mapping, here, reporting the stack when there is
 * one -- a stack carries the message and the line that threw.
 *
 * `test()` collects; nothing runs until the tier function returned by
 * `createSuite` is awaited by `tests/runner.ts`, so a tier file's tests keep the
 * order they are written in.
 */

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  durationMs: number;
}

export type TestFn = () => void | Promise<void>;

export interface TierRun {
  total: number;
  passed: number;
  failed: number;
  results: TestResult[];
}

export interface Suite {
  /** Registers one case. Called at a tier file's top level. */
  test: (name: string, fn: TestFn) => void;
  /** Runs everything registered so far, in order. */
  run: () => Promise<TierRun>;
}

export function createSuite(): Suite {
  const tests: Array<{ name: string; fn: TestFn }> = [];

  return {
    test: (name, fn) => {
      tests.push({ name, fn });
    },

    run: async () => {
      const results: TestResult[] = [];
      let passed = 0;
      let failed = 0;

      for (const t of tests) {
        const start = Date.now();
        try {
          await t.fn();
          results.push({ name: t.name, passed: true, durationMs: Date.now() - start });
          passed++;
        } catch (err: unknown) {
          const error = err instanceof Error ? err.stack || err.message : String(err);
          results.push({ name: t.name, passed: false, error, durationMs: Date.now() - start });
          failed++;
        }
      }

      return { total: tests.length, passed, failed, results };
    },
  };
}
