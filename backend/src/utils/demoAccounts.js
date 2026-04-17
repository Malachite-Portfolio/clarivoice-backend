const RAW_DEMO_ACCOUNT_PHONES = Object.freeze([
  '+910000000101',
  '+910000000102',
  '+910000000103',
  '+910000000104',
  '+910000000105',
  '+910000000106',
  '+910000000201',
  '+910000000202',
  '+910000000203',
  '+910000000204',
  '+910000000205',
  '+910000000206',
]);

const normalizePhoneVariants = (phone) => {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const variants = new Set();

  if (raw) {
    variants.add(raw);
  }
  if (digits) {
    variants.add(digits);
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    variants.add(`+${digits}`);
    variants.add(digits.slice(2));
  }
  if (digits.length === 10) {
    variants.add(`91${digits}`);
    variants.add(`+91${digits}`);
  }

  return [...variants].filter(Boolean);
};

const DEMO_ACCOUNT_PHONE_VALUES = Object.freeze(
  Array.from(
    new Set(
      RAW_DEMO_ACCOUNT_PHONES.flatMap((phone) => normalizePhoneVariants(phone))
    )
  )
);

const DEMO_ACCOUNT_PHONE_SET = new Set(DEMO_ACCOUNT_PHONE_VALUES);

const isDemoAccountPhone = (phone) =>
  normalizePhoneVariants(phone).some((variant) => DEMO_ACCOUNT_PHONE_SET.has(variant));

module.exports = {
  DEMO_ACCOUNT_PHONE_VALUES,
  isDemoAccountPhone,
};

