const bcrypt = require('bcrypt');
const dayjs = require('dayjs');
const jwt = require('jsonwebtoken');
const { prisma } = require('../config/prisma');
const { env } = require('../config/env');
const { logger } = require('../config/logger');
const { signRefreshToken } = require('../utils/tokens');
const referralService = require('../modules/referral/referral.service');
const {
  isSchemaMismatchError,
  toSafePrismaClientError,
} = require('../utils/prismaError');

const LISTENER_PROFILE_AUTH_SELECT = {
  availability: true,
  callRatePerMinute: true,
  chatRatePerMinute: true,
  isEnabled: true,
};

const FIREBASE_LOGIN_USER_INCLUDE = {
  listenerProfile: {
    select: LISTENER_PROFILE_AUTH_SELECT,
  },
};

const DEFAULT_LISTENER_PROFILE_FOR_AUTH = {
  availability: 'OFFLINE',
  callRatePerMinute: 15,
  chatRatePerMinute: 10,
  isEnabled: true,
};

const FIREBASE_LOGIN_TOKEN_EXPIRES_IN =
  process.env.FIREBASE_LOGIN_TOKEN_EXPIRES_IN || '7d';
const FORCED_LISTENER_ROLE_PHONES = new Set(['+918779022654']);

const normalizePhone = (phone) => {
  const sanitized = String(phone || '')
    .replace(/[\s()-]/g, '')
    .trim();
  const digits = sanitized.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (sanitized.startsWith('+')) {
    return `+${digits}`;
  }

  return sanitized;
};

const buildPhoneVariants = (phone) => {
  const normalizedPhone = normalizePhone(phone);
  const digits = normalizedPhone.replace(/\D/g, '');
  const variants = new Set();

  if (normalizedPhone) {
    variants.add(normalizedPhone);
  }

  if (digits) {
    variants.add(digits);
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    variants.add(digits.slice(2));
    variants.add(`+${digits}`);
  }

  if (digits.length === 10) {
    variants.add(`91${digits}`);
    variants.add(`+91${digits}`);
  }

  return [...variants].filter(Boolean);
};

const isForcedListenerRolePhone = (normalizedPhone) =>
  FORCED_LISTENER_ROLE_PHONES.has(normalizePhone(normalizedPhone));

const normalizeRole = (role) => {
  const normalizedRole = String(role || '').trim().toLowerCase();
  if (normalizedRole === 'user') return 'USER';
  if (normalizedRole === 'listener') return 'LISTENER';
  return '';
};

const maskPhone = (phone) => {
  const value = String(phone || '').trim();
  if (!value) return '';
  if (value.length <= 4) return '****';
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
};

const parseDeviceInfo = (deviceInfo) => {
  if (!deviceInfo) {
    return {};
  }

  if (typeof deviceInfo === 'object' && !Array.isArray(deviceInfo)) {
    return deviceInfo;
  }

  if (typeof deviceInfo === 'string') {
    const trimmed = deviceInfo.trim();
    if (!trimmed) {
      return {};
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      return { raw: trimmed };
    } catch (_error) {
      return { raw: trimmed };
    }
  }

  return { raw: String(deviceInfo) };
};

const parseExpiryToDate = (expiresIn) => {
  const match = String(expiresIn || '').match(/^(\d+)([smhd])$/i);
  if (!match) {
    return dayjs().add(30, 'day').toDate();
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const unitMap = {
    s: 'second',
    m: 'minute',
    h: 'hour',
    d: 'day',
  };

  return dayjs().add(value, unitMap[unit]).toDate();
};

const assertAccountAllowed = (user) => {
  if (!user) {
    return;
  }

  if (user.status === 'BLOCKED' || user.status === 'DELETED' || user.deletedAt) {
    const error = new Error('Account is unavailable');
    error.statusCode = 403;
    error.code = 'ACCOUNT_UNAVAILABLE';
    throw error;
  }

  if (user.suspendedUntil && new Date(user.suspendedUntil) > new Date()) {
    const error = new Error('Account is suspended');
    error.statusCode = 403;
    error.code = 'ACCOUNT_SUSPENDED';
    throw error;
  }
};

const sanitizeUserResponse = (user) => {
  const response = {
    id: user.id,
    phone: user.phone,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    status: user.status,
  };

  if (user.role === 'LISTENER' && user.listenerProfile) {
    response.listenerProfile = {
      availability: user.listenerProfile.availability,
      callRatePerMinute: user.listenerProfile.callRatePerMinute,
      chatRatePerMinute: user.listenerProfile.chatRatePerMinute,
      isEnabled: user.listenerProfile.isEnabled,
    };
  }

  return response;
};

const buildDefaultDisplayName = (role, normalizedPhone, displayName) => {
  const requestedDisplayName = String(displayName || '').trim();
  if (requestedDisplayName) {
    return requestedDisplayName;
  }

  const suffix = normalizedPhone.replace(/\D/g, '').slice(-4) || '0000';
  return role === 'LISTENER' ? `Listener-${suffix}` : `Anonymous-${suffix}`;
};

const issueAuthTokens = async ({
  user,
  firebaseUid,
  deviceId,
  deviceInfo,
  ipAddress,
  userAgent,
}) => {
  const accessToken = jwt.sign(
    {
      sub: user.id,
      id: user.id,
      role: user.role,
      phone: user.phone,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: FIREBASE_LOGIN_TOKEN_EXPIRES_IN },
  );

  const sessionId = `sess_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const refreshToken = signRefreshToken({
    sub: user.id,
    sid: sessionId,
    role: user.role,
  });
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

  await prisma.authSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      deviceId: deviceId || null,
      deviceInfo: {
        ...parseDeviceInfo(deviceInfo),
        firebaseUid,
      },
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      status: 'ACTIVE',
      expiresAt: parseExpiryToDate(env.JWT_REFRESH_EXPIRES_IN),
      lastUsedAt: new Date(),
    },
  });

  return {
    token: accessToken,
    accessToken,
    refreshToken,
  };
};

const upsertUserByRole = async ({ normalizedPhone, role, displayName }) => {
  const requestedDisplayName = String(displayName || '').trim();
  const createDisplayName = buildDefaultDisplayName(
    role,
    normalizedPhone,
    requestedDisplayName,
  );
  let listenerProfileSchemaFallback = false;

  const throwRoleMismatch = () => {
    const roleMismatchError = new Error('Account role mismatch for this app');
    roleMismatchError.statusCode = 403;
    roleMismatchError.code = 'ACCOUNT_ROLE_MISMATCH';
    throw roleMismatchError;
  };

  const phoneVariants = buildPhoneVariants(normalizedPhone);
  let userCreated = false;
  let userFoundByVariant = false;
  let phoneNormalizedFromVariant = false;
  let rolePromotedForForcedListener = false;
  let user = await prisma.user.findUnique({
    where: { phone: normalizedPhone },
    include: FIREBASE_LOGIN_USER_INCLUDE,
  });

  if (!user && phoneVariants.length > 1) {
    user = await prisma.user.findFirst({
      where: {
        phone: {
          in: phoneVariants,
        },
      },
      include: FIREBASE_LOGIN_USER_INCLUDE,
    });
    userFoundByVariant = Boolean(user);

    if (user?.phone && user.phone !== normalizedPhone) {
      logger.info('[AuthFirebase] normalized phone migration candidate detected', {
        fromPhone: maskPhone(user.phone),
        toPhone: maskPhone(normalizedPhone),
        userId: user.id,
      });
    }
  }

  assertAccountAllowed(user);

  if (user?.phone && user.phone !== normalizedPhone) {
    try {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: normalizedPhone,
        },
        include: FIREBASE_LOGIN_USER_INCLUDE,
      });
      phoneNormalizedFromVariant = true;
      logger.info('[AuthFirebase] normalized phone migration success', {
        userId: user.id,
        normalizedPhone: maskPhone(normalizedPhone),
      });
    } catch (error) {
      if (error?.code !== 'P2002') {
        throw error;
      }
      user = await prisma.user.findUnique({
        where: { phone: normalizedPhone },
        include: FIREBASE_LOGIN_USER_INCLUDE,
      });
      assertAccountAllowed(user);
    }
  }

  if (user && user.role !== role) {
    if (role === 'LISTENER' && user.role === 'USER' && isForcedListenerRolePhone(normalizedPhone)) {
      logger.info('[AuthFirebase] promoting forced listener phone from USER to LISTENER', {
        phone: maskPhone(normalizedPhone),
        userId: user.id,
      });
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: 'LISTENER',
          status: 'ACTIVE',
          isPhoneVerified: true,
          deletedAt: null,
          ...(requestedDisplayName ? { displayName: requestedDisplayName } : {}),
        },
        include: FIREBASE_LOGIN_USER_INCLUDE,
      });
      rolePromotedForForcedListener = true;
    } else {
      throwRoleMismatch();
    }
  }

  if (!user) {
    try {
      user = await prisma.user.create({
        data: {
          phone: normalizedPhone,
          displayName: createDisplayName,
          role,
          status: 'ACTIVE',
          isPhoneVerified: true,
        },
        include: FIREBASE_LOGIN_USER_INCLUDE,
      });
      userCreated = true;
    } catch (error) {
      if (error?.code !== 'P2002') {
        throw error;
      }

      user = await prisma.user.findUnique({
        where: { phone: normalizedPhone },
        include: FIREBASE_LOGIN_USER_INCLUDE,
      });

      assertAccountAllowed(user);
      if (!user || user.role !== role) {
        throwRoleMismatch();
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          isPhoneVerified: true,
          ...(requestedDisplayName ? { displayName: requestedDisplayName } : {}),
        },
        include: FIREBASE_LOGIN_USER_INCLUDE,
      });
    }
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        isPhoneVerified: true,
        ...(requestedDisplayName ? { displayName: requestedDisplayName } : {}),
      },
      include: FIREBASE_LOGIN_USER_INCLUDE,
    });
  }

  await prisma.wallet.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      currency: 'INR',
    },
  });

  if (role === 'USER') {
    await prisma.userSetting.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
      },
    });
    await referralService.ensureReferralCode(user.id);
  }

  if (role === 'LISTENER') {
    let listenerProfileWasCreated = false;
    let listenerProfileAlreadyExisted = false;
    try {
      const existingProfile = await prisma.listenerProfile.findUnique({
        where: { userId: user.id },
        select: { userId: true },
      });
      listenerProfileAlreadyExisted = Boolean(existingProfile);
    } catch (error) {
      if (!isSchemaMismatchError(error)) {
        throw error;
      }
      listenerProfileAlreadyExisted = false;
      listenerProfileSchemaFallback = true;
      logger.warn('[AuthFirebase] listenerProfile pre-check skipped due schema mismatch', {
        context: 'upsertUserByRole',
        role,
        userId: user.id,
        message: error?.message,
      });
    }

    try {
      await prisma.listenerProfile.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          bio: 'Listener profile',
          rating: 0,
          experienceYears: 0,
          languages: ['English'],
          category: 'Emotional Support',
          callRatePerMinute: 15,
          chatRatePerMinute: 10,
          availability: 'OFFLINE',
          isEnabled: true,
        },
        select: {
          userId: true,
        },
      });
      listenerProfileWasCreated = !listenerProfileAlreadyExisted;
    } catch (error) {
      if (!isSchemaMismatchError(error)) {
        throw error;
      }
      listenerProfileSchemaFallback = true;
      logger.warn('[AuthFirebase] listenerProfile upsert skipped due schema mismatch', {
        context: 'upsertUserByRole',
        role,
        userId: user.id,
        message: error?.message,
      });
    }

    if (env.NODE_ENV !== 'production') {
      logger.info('[AuthFirebase] listener profile link status', {
        phone: maskPhone(normalizedPhone),
        userId: user.id,
        listenerProfileAlreadyExisted,
        listenerProfileWasCreated,
      });
    }
  }

  if (env.NODE_ENV !== 'production') {
    logger.info('[AuthFirebase] user upsert role/link summary', {
      phone: maskPhone(normalizedPhone),
      role,
      userId: user.id,
      userCreated,
      userFoundByVariant,
      phoneNormalizedFromVariant,
      rolePromotedForForcedListener,
    });
  }

  const refreshedUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: FIREBASE_LOGIN_USER_INCLUDE,
  });

  assertAccountAllowed(refreshedUser);

  if (refreshedUser.role === 'LISTENER' && refreshedUser.listenerProfile?.isEnabled === false) {
    const listenerDisabledError = new Error('Listener profile is unavailable');
    listenerDisabledError.statusCode = 403;
    listenerDisabledError.code = 'LISTENER_PROFILE_UNAVAILABLE';
    throw listenerDisabledError;
  }

  if (
    listenerProfileSchemaFallback &&
    refreshedUser.role === 'LISTENER' &&
    !refreshedUser.listenerProfile
  ) {
    return {
      ...refreshedUser,
      listenerProfile: { ...DEFAULT_LISTENER_PROFILE_FOR_AUTH },
    };
  }

  return refreshedUser;
};

const firebaseLogin = async (req, res) => {
  const normalizedPhone = normalizePhone(req.body?.phone);
  const normalizedFirebaseUid = String(req.body?.firebaseUid || '').trim();
  const requestedRole = normalizeRole(req.body?.role);
  const forcedListenerRoleOverride = isForcedListenerRolePhone(normalizedPhone);
  const role = forcedListenerRoleOverride ? 'LISTENER' : requestedRole;
  const displayName = String(req.body?.displayName || '').trim();
  const deviceId = String(req.body?.deviceId || '').trim() || null;
  const deviceInfo = req.body?.deviceInfo;

  if (!normalizedPhone || !normalizedFirebaseUid || !requestedRole) {
    return res.status(400).json({
      success: false,
      code: 'BAD_REQUEST',
      message: 'phone, firebaseUid, and role are required',
    });
  }

  try {
    logger.info('[AuthFirebase] firebase-login request received', {
      phone: maskPhone(normalizedPhone),
      requestedRole,
      role,
      forcedListenerRoleOverride,
      hasDisplayName: Boolean(displayName),
      hasDeviceId: Boolean(deviceId),
      hasDeviceInfo: Boolean(deviceInfo),
    });

    const user = await upsertUserByRole({
      normalizedPhone,
      role,
      displayName,
    });

    const tokens = await issueAuthTokens({
      user,
      firebaseUid: normalizedFirebaseUid,
      deviceId,
      deviceInfo,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.status(200).json({
      success: true,
      message: 'Firebase login successful',
      token: tokens.token,
      user: sanitizeUserResponse(user),
      data: {
        token: tokens.token,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        user: sanitizeUserResponse(user),
      },
    });
  } catch (error) {
    const safePrismaError = toSafePrismaClientError(error);
    const statusCode = Number(
      safePrismaError?.statusCode || error?.statusCode || 500
    );
    const code = String(
      safePrismaError?.code ||
        error?.code ||
        (statusCode >= 500 ? 'FIREBASE_LOGIN_FAILED' : 'BAD_REQUEST')
    );
    const message = String(
      safePrismaError?.message || error?.message || 'Failed to login with Firebase'
    );

    logger.error('[AuthFirebase] firebase-login failed', {
      phone: maskPhone(normalizedPhone),
      role,
      statusCode,
      code,
      message,
      stack: statusCode >= 500 ? error?.stack : undefined,
    });

    return res.status(statusCode).json({
      success: false,
      code,
      message,
    });
  }
};

module.exports = {
  firebaseLogin,
};
