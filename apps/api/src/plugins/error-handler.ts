import type { ApiErrorBody } from '@lotea/shared';
import type { FastifyError, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { AppError } from '../shared/errors/app-error';

// Maps every thrown error to the shared ApiErrorBody shape — see ARCHITECTURE.md
// §7: the server returns an error *code*, never a hardcoded human-facing sentence.
const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler<FastifyError | AppError>((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ApiErrorBody = {
        error: { code: error.code, message: error.message, details: error.details },
      };
      reply.status(error.statusCode).send(body);
      return;
    }

    if (error.validation) {
      const body: ApiErrorBody = {
        error: { code: 'VALIDATION_ERROR', message: error.message, details: error.validation },
      };
      reply.status(400).send(body);
      return;
    }

    request.log.error(error);
    const body: ApiErrorBody = {
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    };
    reply.status(500).send(body);
  });
};

export default fp(errorHandlerPlugin, { name: 'error-handler' });
