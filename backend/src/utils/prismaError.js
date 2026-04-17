const PRISMA_ERROR_CODE_PATTERN = /^P\d{4}$/;

const isPrismaKnownRequestError = (error) =>
  Boolean(error && typeof error.code === 'string' && PRISMA_ERROR_CODE_PATTERN.test(error.code));

const isSchemaMismatchError = (error) => {
  const message = String(error?.message || '');
  return (
    error?.code === 'P2022' ||
    /does not exist in the current database/i.test(message) ||
    /column .* does not exist/i.test(message)
  );
};

const toSafePrismaClientError = (error) => {
  if (!error) {
    return null;
  }

  if (isSchemaMismatchError(error)) {
    return {
      statusCode: 500,
      code: 'DB_SCHEMA_OUT_OF_SYNC',
      message: 'Service is temporarily unavailable. Please try again shortly.',
    };
  }

  if (isPrismaKnownRequestError(error)) {
    return {
      statusCode: 500,
      code: 'DATABASE_ERROR',
      message: 'Unable to process your request right now. Please try again.',
    };
  }

  return null;
};

module.exports = {
  isPrismaKnownRequestError,
  isSchemaMismatchError,
  toSafePrismaClientError,
};

