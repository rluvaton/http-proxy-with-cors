#!/usr/bin/env node

import { parseArgs, printHelp } from './cli.js';
import { CLIError } from './error.js';
import { runServer } from './server.js';

/**
 * @typedef {{ port: number, upstream: string }} ServerConf
 */

/**
 * @param {ServerConf[]} servers
 * @param {boolean=true} logEnabled
 * @return {Promise<void>}
 */
async function start(servers, { logEnabled = true }) {
  await Promise.all(
    servers.map(({ port, upstream }) =>
      runServer(port, upstream, {
        logEnabled,
      }),
    ),
  );
}

const args = process.argv.slice(2);
if (!args.length) {
  printHelp();

  process.exit(0);
}

/**
 * @type {{port: number, upstream: string}[]}
 */
let servers;

try {
  servers = parseArgs(args);

  if (!servers.length) {
    // noinspection ExceptionCaughtLocallyJS
    throw new CLIError({
      message: 'No servers to start',
      showHelp: true,
    });
  }
} catch (error) {
  console.error(error);

  if (error.showHelp) {
    printHelp();
  }

  process.exit(1);
}

start(servers, {
  logEnabled: process.env.LOG_DISABLED !== 'true',
})
  .then(() => {
    console.log('All servers started successfully');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
