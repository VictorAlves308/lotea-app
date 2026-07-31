import type { FastifyServerOptions } from 'fastify';

/**
 * Passed straight to Fastify's built-in pino logger — the single place
 * logging is configured. Silent under test: the integration suite builds
 * dozens of app instances and fires hundreds of requests, and per-request
 * log noise doesn't help there the way it does in real dev/prod use.
 */
export const loggerOptions: FastifyServerOptions['logger'] =
  process.env.NODE_ENV === 'test'
    ? false
    : {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV === 'development'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
              }
            : undefined,
      };
