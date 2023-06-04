import { defineConfig } from 'vite';
import inspector from 'node:inspector';

const DEBUG_MODE = inspector.url() !== undefined;
const ONE_HOUR = 1000 * 60 * 60;

export default defineConfig({
  test: {
    globals: true,
    globalSetup: ['./test/setup/global-setup.js'],
    testTimeout: DEBUG_MODE
      ? ONE_HOUR
      : // 20 seconds as the browser can take some time
        20_000,
  },
});
