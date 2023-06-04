import { defineConfig } from 'vite';
import inspector from 'node:inspector';

const DEBUG_MODE = inspector.url() !== undefined;
const ONE_HOUR = 1000 * 60 * 60;

export default defineConfig({
  test: {
    globals: true,

    testTimeout: DEBUG_MODE ? ONE_HOUR : 5000,
  },
});
