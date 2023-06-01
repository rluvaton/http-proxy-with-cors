import inspector from 'node:inspector';
import { defineConfig } from 'vitest/config';

const DEBUG_MODE = inspector.url() !== undefined;
const ONE_HOUR = 1000 * 60 * 60;

export default defineConfig({
  test: {
    globals: true,
    typecheck: {
      tsconfig: './tsconfig.json',
    },
    environment: 'node',

    // globalSetup: './test/setup/global-setup.ts',
    // globalTeardown: './test/setup/global-teardown.ts',

    setupFiles: ['./test/setup/setup-test.ts'],
    modulePathIgnorePatterns: ['debug'],
    collectCoverageFrom: ['src/**/!(*.mock.ts)'],
    resetMocks: true,
    restoreMocks: true,

    // Not running in isolation, so we write tests that can be run on 1 thread without isolation,
    // and it will help in the future when want to run 1 server instance for all the tests
    isolate: false,
    silent: false,
    reporters: ['default'],
    threads: true,

    testTimeout: DEBUG_MODE ? ONE_HOUR : 5000,
  },
} as any);
