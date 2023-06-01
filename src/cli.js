import fs from 'node:fs';

import { isValidHttpUrl } from './utils.js';
import { CLIError } from './error.js';

export function printHelp() {
  console.log(`
Usage: proxy-http-with-cors <local-port-1> <upstream-1> ... <local-port-n> <upstream-n>

It will create a proxy server on each local port that will proxy all requests to the upstream server.

Env vars:
  - LOG_DISABLED: setting it to 'false' will disable logging

Options:
  -f, --file | a file path to a JSON file containing the servers configuration in the format: {port: number, upstream: string}[]
`);
}

/**
 * @param {string[]} args
 * @return {{{port: number, upstream: string}[]}}
 */
export function parseArgs(args) {
  const fileIndex = args.findIndex((arg) => arg === '-f' || arg === '--file');
  const useFile = fileIndex !== -1;

  /**
   * @type {{port: string | number, upstream: string}[]}
   */
  let config = [];

  if (!useFile && args.length % 2 !== 0) {
    throw new CLIError({
      message: 'Invalid number of arguments',
      showHelp: true,
    });
  }

  if (useFile) {
    const configPath = args[fileIndex + 1];

    if (!configPath) {
      throw new CLIError({
        message: 'Missing file path',
        showHelp: true,
      });
    }

    let configFromFile = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    if (!Array.isArray(configFromFile)) {
      configFromFile = [configFromFile];
    }
    config = configFromFile;
  } else {
    config = [];

    for (let i = 0; i < args.length; i += 2) {
      config.push({
        port: args[i],
        upstream: args[i + 1],
      });
    }
  }

  const servers = [];
  for (const server of config) {
    const port = assertPortIsValid(server.port);
    const upstream = assertUpstreamIsValid(server.upstream);

    assertServerConfigIsValid(servers, { port, upstream });

    servers.push({ port, upstream });
  }

  return servers;
}

/**
 *
 * @param {string | number} portArg
 * @return {number}
 */
function assertPortIsValid(portArg) {
  const port = parseInt(portArg);
  const isValidPort = port >= 0 && port <= 65536;

  if (!isValidPort) {
    throw new CLIError({
      message: `Invalid port number ${portArg}`,
      showHelp: false,
    });
  }

  return port;
}

/**
 *
 * @param {string} upstream
 * @return {string}
 */
function assertUpstreamIsValid(upstream) {
  if (!upstream) {
    throw new CLIError({
      message: `Missing upstream`,
      showHelp: false,
    });
  }

  if (!isValidHttpUrl(upstream)) {
    throw new CLIError({
      message: `Invalid upstream ${upstream}, must start with http:// or https://`,
      showHelp: false,
    });
  }

  return upstream;
}

function assertServerConfigIsValid(servers, singleServer) {
  if (servers.find((server) => server.port === singleServer.port)) {
    throw new CLIError({
      message: `Port ${singleServer.port} is already in use by another upstream, please use a different port`,
      showHelp: false,
    });
  }
}
