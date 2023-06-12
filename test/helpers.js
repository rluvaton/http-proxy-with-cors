import net from 'node:net';
import inspector from 'node:inspector';
import childProcess from 'node:child_process';
import { executableName } from './const.js';
import { setTimeout } from 'timers';

export function isDebug() {
  return inspector.url() !== undefined;
}

/**
 * @return {Promise<number>}
 */
async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

/**
 * @param {number} numberOfAvailablePortsToSearch
 * @return {Promise<number[]>}
 */
export function getAvailablePorts(numberOfAvailablePortsToSearch) {
  return Promise.all(Array.from({ length: numberOfAvailablePortsToSearch }, findAvailablePort));
}

/**
 *
 * @param {{port?: number, upstream: string}[]} config
 * @return {Promise<{
 *   ports: number[],
 *   cleanup: () => Promise<void>,
 * }>}
 */
export async function runCli(config) {
  const numberOfAvailablePortsToSearch = config.filter(({ port }) => !port).length;

  const availablePorts = await getAvailablePorts(numberOfAvailablePortsToSearch);

  config.forEach((serverConfig) => {
    if (!serverConfig.port) {
      serverConfig.port = availablePorts.shift();
    }
  });

  const ac = new AbortController();
  const subprocess = childProcess.exec(
    `${executableName} ${config.flatMap(({ port, upstream }) => [port, upstream]).join(' ')}`,
    {
      signal: ac.signal,
    },
  );

  subprocess.stderr.pipe(process.stderr);

  const proxyServerCleanup = () => {
    // Already exit
    // noinspection EqualityComparisonWithCoercionJS
    if (subprocess.exitCode != undefined) {
      return;
    }
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ac.abort();
      }, 5000);

      subprocess.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });

      subprocess.kill();
    });
  };

  await waitForReadyUntilTimeout(subprocess, proxyServerCleanup);

  return {
    ports: config.map(({ port }) => port),
    cleanup: proxyServerCleanup,
  };
}

function waitForReadyUntilTimeout(subprocess, close) {
  // either having a log: `All servers started successfully` or timeout
  // Don't forget to cleanup the server listeners

  return new Promise((resolve, reject) => {
    let timeout;
    let output = '';

    function onData(data) {
      output += data.toString();

      if (output.includes('All servers started successfully')) {
        subprocess.stdout.off('data', onData);
        clearTimeout(timeout);
        resolve();
      }
    }

    subprocess.stdout.on('data', onData);

    timeout = setTimeout(() => {
      subprocess.stdout.off('data', onData);

      close();
      reject(new Error('Failed to connect in 5 seconds, timeout'));
    }, 5000);
  });
}
