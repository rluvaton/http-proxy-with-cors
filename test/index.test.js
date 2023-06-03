import net from 'node:net';
import Fastify from 'fastify';

const childProcess = require('child_process');
import { describe, afterEach, it, expect } from 'vitest';
import { cliScript } from './const.js';

describe('test', () => {
  /**
   * @type {import("fastify").FastifyInstance[]}
   */
  let fastifyServers = [];
  /**
   * @type {() => Promise<void>}
   */
  let proxyServerCleanup;

  /**
   *
   * @param {(fastify: import("fastify").FastifyInstance) => void} setRoutes
   * @return {Promise<*>}
   */
  async function createServer(setRoutes) {
    const fastify = Fastify({
      logger: false,
    });

    setRoutes(fastify);

    await fastify.listen({ port: 0, host: 'localhost' });

    fastifyServers.push(fastify);

    return fastify.server.address().port;
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
  function getAvailablePorts(numberOfAvailablePortsToSearch) {
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
  async function proxyServers(config) {
    const numberOfAvailablePortsToSearch = config.filter(({ port }) => !port).length;

    const availablePorts = await getAvailablePorts(numberOfAvailablePortsToSearch);

    config.forEach((serverConfig) => {
      if (!serverConfig.port) {
        serverConfig.port = availablePorts.shift();
      }
    });

    const subprocess = childProcess.fork(
      cliScript,
      config.flatMap(({ port, upstream }) => [port, upstream]),
      {
        stdio: 'pipe',
      },
    );

    proxyServerCleanup = () => {
      // Already exit
      if (subprocess.exitCode != undefined) {
        return;
      }
      return new Promise((resolve) => {
        subprocess.on('exit', () => {
          resolve();
        });
        subprocess.kill('SIGTERM', {
          forceKillAfterTimeout: 2000,
        });
      });
    };

    return new Promise((resolve, reject) => {
      function waitForReady(message) {
        if (message !== 'ready') {
          return;
        }

        subprocess.off('message', waitForReady);
        clearTimeout(timeout);

        resolve({
          ports: config.map(({ port }) => port),
          cleanup: proxyServerCleanup,
        });
      }

      let timeout = setTimeout(async () => {
        await proxyServerCleanup();
        reject('Failed to connect in 2 seconds, timeout');
      }, 2000);

      timeout.unref();
      subprocess.on('message', waitForReady);
    });
  }

  afterEach(async () => {
    await proxyServerCleanup();
    await Promise.all(fastifyServers.map((fastify) => fastify.close()));

    fastifyServers = [];
  });

  describe('GET', () => {
    describe('body', () => {
      it('should return the response body as string', async () => {
        const upstreamPort = await createServer((fastify) => {
          fastify.get('/', async () => 'Hello World!');
        });
        const {
          ports: [port],
        } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

        // TODO - DISABLE CORS SOMEHOW
        const response = await fetch(`http://localhost:${port}/`, {});
        await expect(response.text()).resolves.toEqual('Hello World!');
      });

      it('should return the response body as json', async () => {
        const upstreamPort = await createServer((fastify) => {
          fastify.get('/', async () => ({
            message: 'Hello World!',
          }));
        });
        const {
          ports: [port],
        } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

        const response = await fetch(`http://localhost:${port}/`);
        await expect(response.json()).resolves.toEqual({
          message: 'Hello World!',
        });
      });
    });

    describe('status status code', () => {
      it.each`
        statusText | startStatus
        ${'2xx'}   | ${200}
        ${'3xx'}   | ${300}
        ${'4xx'}   | ${400}
        ${'5xx'}   | ${500}
      `('should return the response status when its $statusText', async ({ startStatus }) => {
        const status = Math.floor(Math.random() * 100 + startStatus);
        const upstreamPort = await createServer((fastify) => {
          fastify.get('/', async (res, reply) => {
            reply.status(status);
            return 'Hello World!';
          });
        });
        const {
          ports: [port],
        } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

        const response = await fetch(`http://localhost:${port}/`);
        expect(response.status).toEqual(status);
      });
    });

    describe('headers', () => {
      it('should return the response headers', async () => {
        const upstreamPort = await createServer((fastify) => {
          fastify.get('/', async (request, reply) => {
            reply.header('x-test', 'test');
            return 'Hello World!';
          });
        });
        const {
          ports: [port],
        } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

        const response = await fetch(`http://localhost:${port}/`);
        expect(response.headers.get('x-test')).toEqual('test');
      });

      it('should pass the request headers', async () => {
        const upstreamPort = await createServer((fastify) => {
          fastify.get('/', async (req) => req.headers['x-test']);
        });
        const {
          ports: [port],
        } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

        const response = await fetch(`http://localhost:${port}/`, {
          headers: {
            'x-test': 'test 1',
          },
        });
        await expect(response.text()).resolves.toEqual('test 1');
      });
    });
  });
});
