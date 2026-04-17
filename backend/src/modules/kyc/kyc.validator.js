const { z } = require('zod');

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isValidDob = (dob) => {
  const value = String(dob || '').trim();
  if (!DOB_PATTERN.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }
  return parsed.getTime() <= Date.now();
};

const submitKycSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    aadhaarLast4: z.string().trim().regex(/^\d{4}$/),
    dob: z
      .string()
      .trim()
      .refine((value) => isValidDob(value), {
        message: 'dob must be a valid date in YYYY-MM-DD format and not in the future',
      }),
  })
  .strict();

module.exports = {
  submitKycSchema,
};
