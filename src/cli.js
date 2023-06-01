import { isValidHttpUrl } from './utils.js';
import { CLIError } from './error.js';

export function printHelp() {
  console.log(`
Usage: proxy-http-with-cors <local-port-1> <upstream-1> ... <local-port-n> <upstream-n>

It will create a proxy server on each local port that will proxy all requests to the upstream server.

Env vars:
  - LOG_DISABLED: setting it to 'false' will disable logging
`);
}

/**
 * @param {string[]} args
 * @return {{{port: number, upstream: string}[]}}
 */
export function parseArgs(args) {
  if (args.length % 2 !== 0) {
    throw new CLIError({
      message: 'Invalid number of arguments',
      showHelp: true,
    });
  }

  const servers = [];
  for (let i = 0; i < args.length; i += 2) {
    const port = parseInt(args[i]);
    const isValidPort = port >= 0 && port <= 65536;

    if (!isValidPort) {
      throw new CLIError({
        message: `Invalid port number ${args[i]}`,
        showHelp: false,
      });
    }

    const upstream = args[i + 1];
    if (!isValidHttpUrl(upstream)) {
      throw new CLIError({
        message: `Invalid upstream ${upstream}, must start with http:// or https://`,
        showHelp: false,
      });
    }

    if (servers.find((server) => server.port === port)) {
      throw new CLIError({
        message: `Port ${port} is already in use by another upstream, please use a different port`,
        showHelp: false,
      });
    }

    servers.push({
      port: parseInt(args[i]),
      upstream: upstream,
    });
  }

  return servers;
}
