import Fastify from 'fastify';
import FastifyCookies from '@fastify/cookie';
import { chromium } from 'playwright';
import { isDebug, runCli } from './helpers.js';
import { describe, beforeAll, afterEach, afterAll, it, expect } from 'vitest';

describe('test', () => {
  /** @type {import("fastify").FastifyInstance[]} */
  let fastifyServers = [];

  /** @type {() => Promise<void>} */
  let proxyServerCleanup;

  /** @type {import("fastify").FastifyInstance} */
  let echoServer;

  /** @type {number} */
  let echoServerPort;

  /** @type {import("playwright").Browser} */
  let browser;

  /** @type {import("playwright").Page} */
  let page;

  /** @type {string[]} */
  let browserLogs = [];

  beforeAll(async () => {
    echoServer = Fastify({
      logger: false,
    });

    echoServer.get('/', async () => {
      return 'Hello World!';
    });

    await echoServer.listen({ port: 0, host: 'localhost' });

    echoServerPort = echoServer.server.address().port;

    browser = await chromium.launch({ headless: !isDebug(), devtools: isDebug() });

    // Create a new page inside context.
    page = await browser.newPage();

    // For debugging
    page.on('console', (msg) => {
      const logMessage = msg.text();
      browserLogs.push(logMessage);
      console.log('browser message:', logMessage);
    });
    await page.goto(`http://localhost:${echoServerPort}/`);
  });

  afterEach(async () => {
    await proxyServerCleanup?.();
    await Promise.all(fastifyServers.map((fastify) => fastify.close()));

    fastifyServers = [];
    browserLogs = [];
  });

  afterAll(async () => {
    await Promise.all([echoServer.close(), browser.close()]);
  });

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
   *
   * @param {{port?: number, upstream: string}[]} config
   * @return {Promise<{
   *   ports: number[],
   *   cleanup: () => Promise<void>,
   * }>}
   */
  async function proxyServers(config) {
    const { ports, cleanup } = await runCli(config);

    proxyServerCleanup = cleanup;

    return {
      ports: ports,
      cleanup,
    };
  }

  /**
   * This sends request from the browser context so we would have CORS error in case exists, as CORS are something the browser enforces.
   * @param {Parameters<typeof fetch>} args
   * @return {Promise<{status: number, text: string, json: object, arrayBuffer: ArrayBuffer, headers: object}>}
   */
  async function sendRequest(...args) {
    const getHeaders = new Promise((resolve) => {
      // Need to get headers like that as for some reason, inside the browser context, we can't get all the headers,
      // even when we see them in the dev tools
      page.once('response', async (res) => {
        resolve(await res.allHeaders());
      });
    });

    const res = await page.evaluate(async (fetchArgs) => {
      const response = await fetch(...fetchArgs);

      const textClone = await response.clone();
      const jsonClone = await response.clone();
      const arrayBufferClone = await response.clone();

      return {
        status: response.status,

        // --- Body ---
        text: await textClone.text(),

        // Catch errors as some responses are not JSON
        json: await jsonClone.json().catch(() => undefined),
        arrayBuffer: await arrayBufferClone.arrayBuffer(),
      };
    }, args);

    res.headers = await getHeaders;

    return res;
  }

  function wasBlockedByCors() {
    return browserLogs.some((log) => log.includes('blocked by CORS policy'));
  }

  describe('General CORS policy', () => {
    it('should fail by CORS error by default when not passing through the proxy', async () => {
      const upstreamPort = await createServer((fastify) => {
        fastify.get('/', async () => 'Hello World!');
      });

      await expect(sendRequest(`http://localhost:${upstreamPort}/`)).rejects.toThrow();

      expect(wasBlockedByCors()).toEqual(true);
    });

    it('should not have CORS error when passing through the proxy', async () => {
      const upstreamPort = await createServer((fastify) => {
        fastify.get('/', async () => 'Hello World!');
      });
      const {
        ports: [port],
      } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

      await sendRequest(`http://localhost:${port}/`);

      expect(wasBlockedByCors()).toEqual(false);
    });

    it('should not have CORS error when passing through the proxy and having credentials: include ', async () => {
      const upstreamPort = await createServer((fastify) => {
        fastify.get('/', async () => 'Hello World!');
      });
      const {
        ports: [port],
      } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

      await sendRequest(`http://localhost:${port}/`, {
        credentials: 'include',
      });

      expect(wasBlockedByCors()).toEqual(false);
    });
  });

  describe('General Proxy', () => {
    describe.each`
      method      | body
      ${'GET'}    | ${undefined}
      ${'POST'}   | ${{}}
      ${'PATCH'}  | ${{}}
      ${'DELETE'} | ${undefined}
    `('$method', ({ method, body }) => {
      describe('query params', () => {
        it('should pass query params as is', async () => {
          const upstreamPort = await createServer((fastify) => {
            // return the URL so we know the query params are passed as is
            fastify[method.toLowerCase()]('/', async (req) => req.url);
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const queryParamsUrl = '?name[]=jarvis&name[]=thanos&creator=tony%20stark';

          const response = await sendRequest(`http://localhost:${port}/${queryParamsUrl}`, {
            method,
            body,
          });
          expect(response.text).toEqual(`/${queryParamsUrl}`);
        });
      });

      describe('response body', () => {
        it('should return the response body as string', async () => {
          const upstreamPort = await createServer((fastify) => {
            fastify[method.toLowerCase()]('/', async () => 'Hello World!');
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const response = await sendRequest(`http://localhost:${port}/`, {
            method,
            body,
          });
          expect(response.text).toEqual('Hello World!');
        });

        it('should return the response body as json', async () => {
          const upstreamPort = await createServer((fastify) => {
            fastify[method.toLowerCase()]('/', async () => ({
              message: 'Hello World!',
            }));
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const response = await sendRequest(`http://localhost:${port}/`, {
            method,
            body,
          });
          expect(response.json).toEqual({
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
            fastify[method.toLowerCase()]('/', async (res, reply) => {
              reply.status(status);
              return 'Hello World!';
            });
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const response = await sendRequest(`http://localhost:${port}/`, {
            method,
            body,
          });
          expect(response.status).toEqual(status);
        });
      });

      describe('headers', () => {
        it('should return the response headers', async () => {
          const upstreamPort = await createServer((fastify) => {
            fastify[method.toLowerCase()]('/', async (request, reply) => {
              reply.header('x-test', 'test');
              return 'Hello World!';
            });
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const response = await sendRequest(`http://localhost:${port}/`, {
            method,
            body,
          });
          expect(response.headers['x-test']).toEqual('test');
        });

        it('should pass the request headers', async () => {
          const upstreamPort = await createServer((fastify) => {
            fastify[method.toLowerCase()]('/', async (req) => req.headers['x-test']);
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const response = await sendRequest(`http://localhost:${port}/`, {
            method,
            body,
            headers: {
              'x-test': 'test 1',
            },
          });
          expect(response.text).toEqual('test 1');
        });
      });

      describe('credentials', () => {
        it('should get response when credentials is true', async () => {
          const upstreamPort = await createServer((fastify) => {
            fastify[method.toLowerCase()]('/', async () => 'Hello World!');
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const response = await sendRequest(`http://localhost:${port}/`, {
            method,
            body,
            credentials: 'include',
          });
          expect(response.text).toEqual('Hello World!');
        });
      });

      describe('cookies', () => {
        it('should set cookies', async () => {
          const upstreamPort = await createServer((fastify) => {
            fastify.register(FastifyCookies, {
              hook: 'onRequest',
            });

            fastify[method.toLowerCase()]('/', async (req, reply) => {
              reply.setCookie('myCookieName', 'myCookieValue');
              return 'Hello World!';
            });
          });
          const {
            ports: [port],
          } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

          const response = await sendRequest(`http://localhost:${port}/`, {
            method,
            body,
            credentials: 'include',
          });

          expect(response.text).toEqual('Hello World!');

          const browserCookies = await page.evaluate(() => document.cookie);

          expect(browserCookies).toEqual('myCookieName=myCookieValue');
        });
      });
    });
  });

  describe('Methods with request body', () => {
    describe.each`
      method
      ${'POST'}
      ${'PATCH'}
    `('$method', ({ method }) => {
      it('should pass the request body as string', async () => {
        const upstreamPort = await createServer((fastify) => {
          fastify[method.toLowerCase()]('/', async (req) => req.body);
        });
        const {
          ports: [port],
        } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

        const response = await sendRequest(`http://localhost:${port}/`, {
          method,
          body: 'Hello World!',
        });
        expect(response.text).toEqual('Hello World!');
      });

      it('should pass the request body as json', async () => {
        const upstreamPort = await createServer((fastify) => {
          fastify[method.toLowerCase()]('/', async (req) => req.body);
        });
        const {
          ports: [port],
        } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]);

        const response = await sendRequest(`http://localhost:${port}/`, {
          method,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Hello World!',
          }),
        });
        expect(response.json).toEqual({
          message: 'Hello World!',
        });
      });
    });
  });

  describe('double slash at the beginning', () => {
    /** @type {number} */
    let port;

    beforeEach(async () => {
      const upstreamPort = await createServer((fastify) => {
        fastify.get('*', async (req) => req.url);
      });

      ({
        ports: [port],
      } = await proxyServers([{ upstream: `http://localhost:${upstreamPort}` }]));
    });

    it('should work with double slashes', async () => {
      const response = await sendRequest(`http://localhost:${port}//`, {
        method: 'GET',
      });
      expect(response.text).toEqual(`//`);
    });

    it('should work with double slashes and then route', async () => {
      const response = await sendRequest(`http://localhost:${port}//route`, {
        method: 'GET',
      });
      expect(response.text).toEqual(`//route`);
    });
  });
});
