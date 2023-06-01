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

  fastify.addHook('onResponse', (request, reply, done) => {
    done();
  });

  return fastify;
}

export async function runServer(port, upstream, options = {}) {
  const fastify = await createServer({ upstream }, options);
  try {
    await fastify.listen({ host: '0.0.0.0', port: port });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
