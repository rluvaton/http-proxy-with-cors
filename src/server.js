import Fastify from 'fastify';
import FastifyPluginCors from '@fastify/cors';
import FastifyPluginHttpProxy from '@fastify/http-proxy';
import chalk from 'chalk';

async function createServer({ upstream }, options) {
  let loggerOptions = false;

  if (options.logEnabled) {
    const upstreamForLog = new URL(upstream).host;
    loggerOptions = {
      transport: {
        target: 'pino-pretty',
        options: {
          ignore: 'pid,hostname',
          messageFormat: chalk.white(`[upstream: ${upstreamForLog}]`) + ' {msg}',
        },
      },
    };
  }

  const fastify = Fastify({
    logger: loggerOptions,
  });

  fastify.register(FastifyPluginCors, {
    credentials: true,
    // Allow all origins
    origin: /.*/,
  });

  fastify.register(FastifyPluginHttpProxy, {
    upstream,
    // Not setting OPTIONS as it is handled by cors plugin
    httpMethods: ['DELETE', 'GET', 'HEAD', 'PATCH', 'POST', 'PUT'],
  });

  return fastify;
}

export async function runServer(port, upstream, options = {}) {
  const fastify = await createServer({ upstream }, options);
  try {
    await fastify.listen({ host: '0.0.0.0', port: port });

    if (!options.logEnabled) {
      console.log(`Server listening on http://localhost:${fastify.server.address().port} and proxying to ${upstream}`);
    }
  } catch (err) {
    if (!options.logEnabled) {
      console.error(`Failed to start server listening on http://localhost:${port} and proxying to ${upstream}`, err);
    } else {
      fastify.log.error(
        err,
        `Failed to start server listening on http://localhost:${port} and proxying to ${upstream}`,
      );
    }
    process.exit(1);
  }
}
