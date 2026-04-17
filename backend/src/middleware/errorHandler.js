const { StatusCodes } = require('http-status-codes');
const { logger } = require('../config/logger');
const { errorResponse } = require('../utils/apiResponse');
const { toSafePrismaClientError } = require('../utils/prismaError');

const errorHandler = (error, req, res, _next) => {
  const safePrismaError = toSafePrismaClientError(error);
  const parseError =
    error?.type === 'entity.parse.failed' || error instanceof SyntaxError;
  let statusCode =
    safePrismaError?.statusCode ||
    error.statusCode ||
    error.status ||
    (parseError ? StatusCodes.BAD_REQUEST : StatusCodes.INTERNAL_SERVER_ERROR);
  let code =
    safePrismaError?.code ||
    error.code ||
    (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  let message =
    safePrismaError?.message ||
    (parseError && !error?.message
      ? 'Invalid JSON payload'
      : error.message || 'Something went wrong');
  const data = safePrismaError ? null : error.data || null;
  const requestMeta = {
    method: req?.method,
    path: req?.originalUrl || req?.url,
  };

  console.error('[EXPRESS_ERROR]', requestMeta, {
    code,
    statusCode,
    message,
  });

  if (statusCode >= 500) {
    logger.error(message, {
      code,
      stack: error.stack,
      originalCode: error?.code,
      originalMessage: error?.message,
      ...requestMeta,
    });
  } else {
    logger.warn(message, { code, data, ...requestMeta });
  }

  return errorResponse(res, message, code, statusCode, data);
};

module.exports = { errorHandler };
