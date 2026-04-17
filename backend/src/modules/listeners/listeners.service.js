const { prisma } = require('../../config/prisma');
const { logger } = require('../../config/logger');
const { AppError } = require('../../utils/appError');
const { isSchemaMismatchError } = require('../../utils/prismaError');
const { emitHostStatusChanged } = require('../../services/realtimeSync.service');
const { DEMO_ACCOUNT_PHONE_VALUES } = require('../../utils/demoAccounts');
const {
  uploadBufferToFirebaseStorage,
  deleteFromFirebaseStorage,
} = require('../../services/firebaseStorage.service');

const toNumber = (value) => Number(value || 0);
const ACTIVE_USER_STATUSES = new Set(['ACTIVE']);
const LISTENER_REVIEW_REQUIRED_STATUSES = new Set(['PENDING_VERIFICATION', 'REJECTED']);
const LISTENER_UPLOAD_EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const KYC_APPROVED_STATUS = 'APPROVED';

const resolveKycGateMessage = ({ kycStatus, reviewNote, hasKycRecord }) => {
  const normalizedStatus = String(kycStatus || '').trim().toUpperCase();
  if (!hasKycRecord) {
    return 'Complete KYC to continue.';
  }
  if (normalizedStatus === 'DRAFT') {
    return 'Finish your verification.';
  }
  if (normalizedStatus === 'PENDING') {
    return 'Your KYC is under review.';
  }
  if (normalizedStatus === 'REJECTED') {
    const note = String(reviewNote || '').trim();
    return note ? `KYC rejected: ${note}` : 'KYC was rejected. Please update details and resubmit.';
  }
  return 'Complete KYC to continue.';
};

const sanitizePathSegment = (value, fallback = 'document') => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return normalized || fallback;
};

const resolveUploadExtension = ({ mimeType, originalFileName }) => {
  const normalizedMimeType = String(mimeType || '')
    .trim()
    .toLowerCase();
  if (LISTENER_UPLOAD_EXTENSION_BY_MIME_TYPE[normalizedMimeType]) {
    return LISTENER_UPLOAD_EXTENSION_BY_MIME_TYPE[normalizedMimeType];
  }

  const fileName = String(originalFileName || '')
    .trim()
    .replace(/[?#].*$/, '');
  if (fileName.includes('.')) {
    const candidate = fileName.split('.').pop();
    if (candidate) {
      return candidate.toLowerCase();
    }
  }

  return 'jpg';
};

const buildListenerOnboardingStoragePath = ({
  listenerId,
  assetType,
  governmentIdType,
  mimeType,
  originalFileName,
}) => {
  const extension = resolveUploadExtension({ mimeType, originalFileName });
  const timestamp = Date.now();

  if (assetType === 'profile-image') {
    return `profile/${listenerId}/profile-${timestamp}.${extension}`;
  }

  const normalizedGovernmentIdType = sanitizePathSegment(governmentIdType, 'government-id');
  return `kyc/${listenerId}/${normalizedGovernmentIdType}-${timestamp}.${extension}`;
};

const normalizeNullableString = (value, maxLength = 1024) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length > maxLength) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
};

const normalizeStringArray = (value, maxItems = 30, maxItemLength = 80) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) => normalizeNullableString(item, maxItemLength))
        .filter(Boolean)
        .slice(0, maxItems)
    ),
  ];
};

const buildOnboardingSnapshot = (payload = {}) => {
  const snapshot =
    payload.onboardingData && typeof payload.onboardingData === 'object' && !Array.isArray(payload.onboardingData)
      ? { ...payload.onboardingData }
      : {};

  const normalizedFields = {
    selectedName: normalizeNullableString(payload.selectedName, 80),
    displayName: normalizeNullableString(payload.displayName, 80),
    dateOfBirth: normalizeNullableString(payload.dateOfBirth, 32),
    education: normalizeNullableString(payload.education, 180),
    languages: normalizeStringArray(payload.languages, 30, 40),
    experienceCategories: normalizeStringArray(payload.experienceCategories, 30, 80),
    experienceReason: normalizeNullableString(payload.experienceReason, 180),
    experienceStory: normalizeNullableString(payload.experienceStory, 2000),
    note: normalizeNullableString(payload.note, 2000),
    profileImageRef: normalizeNullableString(payload.profileImageRef, 1024),
    governmentIdType: normalizeNullableString(payload.governmentIdType, 120),
    governmentIdImageRef: normalizeNullableString(payload.governmentIdImageRef, 1024),
    submittedVia: 'mobile_listener_onboarding',
  };

  Object.entries(normalizedFields).forEach(([key, value]) => {
    if (value === null) {
      return;
    }

    if (Array.isArray(value) && value.length === 0) {
      return;
    }

    snapshot[key] = value;
  });

  return snapshot;
};

const ensureListenerProfile = async (listenerId) => {
  const profile = await prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    select: {
      userId: true,
    },
  });

  if (!profile) {
    throw new AppError('Listener profile not found', 404, 'LISTENER_NOT_FOUND');
  }

  return profile;
};

const ensureTargetUser = async ({ userId, errorCode = 'USER_NOT_FOUND' }) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      displayName: true,
      profileImageUrl: true,
      status: true,
      deletedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user || user.deletedAt || !ACTIVE_USER_STATUSES.has(String(user.status || '').toUpperCase())) {
    throw new AppError('User not found', 404, errorCode);
  }

  return user;
};

const listListeners = async ({ page, limit, availability, category, language }) => {
  const skip = (page - 1) * limit;

  const where = {
    isEnabled: true,
    user: {
      status: 'ACTIVE',
      deletedAt: null,
      phone: {
        notIn: DEMO_ACCOUNT_PHONE_VALUES,
      },
    },
    ...(availability ? { availability } : {}),
    ...(category ? { category } : {}),
    ...(language ? { languages: { has: language } } : {}),
  };

  const [items, total, syncMeta] = await Promise.all([
    prisma.listenerProfile.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: [{ availability: 'asc' }, { rating: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.listenerProfile.count({ where }),
    prisma.listenerProfile.aggregate({
      where,
      _max: { updatedAt: true },
    }),
  ]);

  const latestSyncTimestamp = syncMeta?._max?.updatedAt
    ? new Date(syncMeta._max.updatedAt).getTime()
    : Date.now();

  return {
    items,
    syncVersion: latestSyncTimestamp,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getListenerById = async (listenerId) => {
  return prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          profileImageUrl: true,
          status: true,
        },
      },
    },
  });
};

const getListenerAvailability = async (listenerId) => {
  const profile = await prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    select: {
      userId: true,
      availability: true,
      isEnabled: true,
      callRatePerMinute: true,
      chatRatePerMinute: true,
      updatedAt: true,
    },
  });

  if (
    profile &&
    String(profile.availability || '').trim().toUpperCase() === 'BUSY'
  ) {
    const [activeCallCount, activeChatCount] = await Promise.all([
      prisma.callSession.count({
        where: {
          listenerId,
          status: {
            in: ['REQUESTED', 'RINGING', 'ACTIVE'],
          },
        },
      }),
      prisma.chatSession.count({
        where: {
          listenerId,
          status: 'ACTIVE',
        },
      }),
    ]);

    if (activeCallCount === 0 && activeChatCount === 0) {
      const recovered = await prisma.listenerProfile.update({
        where: { userId: listenerId },
        data: {
          availability: 'ONLINE',
        },
        select: {
          userId: true,
          availability: true,
          isEnabled: true,
          callRatePerMinute: true,
          chatRatePerMinute: true,
          updatedAt: true,
        },
      });

      emitHostStatusChanged({
        listenerId,
        status: 'ONLINE',
        availability: 'ONLINE',
        isEnabled: recovered.isEnabled,
        updatedAt: recovered.updatedAt,
        reason: 'STALE_BUSY_RECOVERED',
      });

      return recovered;
    }
  }

  return profile;
};

const updateListenerAvailability = async ({ listenerId, availability }) => {
  const listener = await prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    include: {
      user: {
        select: {
          id: true,
          status: true,
          displayName: true,
          deletedAt: true,
          kycVerification: {
            select: {
              id: true,
              status: true,
              reviewNote: true,
            },
          },
        },
      },
    },
  });

  if (!listener || !listener.user) {
    throw new AppError('Listener profile not found', 404, 'LISTENER_NOT_FOUND');
  }

  if (!listener.isEnabled || listener.user.status !== 'ACTIVE' || listener.user.deletedAt) {
    throw new AppError('Listener account is not available', 403, 'LISTENER_UNAVAILABLE');
  }

  const normalizedVerificationStatus = String(listener.verificationStatus || '').toUpperCase();
  const requestedAvailability = String(availability || '').toUpperCase();
  if (
    LISTENER_REVIEW_REQUIRED_STATUSES.has(normalizedVerificationStatus) &&
    (requestedAvailability === 'ONLINE' || requestedAvailability === 'BUSY')
  ) {
    throw new AppError(
      'Profile verification is pending review. You can go online after approval.',
      403,
      'PROFILE_UNDER_REVIEW'
    );
  }

  const kycRecord = listener.user.kycVerification;
  const normalizedKycStatus = String(kycRecord?.status || '').trim().toUpperCase();
  if (
    (requestedAvailability === 'ONLINE' || requestedAvailability === 'BUSY') &&
    normalizedKycStatus !== KYC_APPROVED_STATUS
  ) {
    throw new AppError(
      resolveKycGateMessage({
        kycStatus: normalizedKycStatus,
        reviewNote: kycRecord?.reviewNote,
        hasKycRecord: Boolean(kycRecord?.id),
      }),
      403,
      'KYC_APPROVAL_REQUIRED',
      {
        kycStatus: kycRecord?.status || 'NOT_STARTED',
      }
    );
  }

  const updated = await prisma.listenerProfile.update({
    where: { userId: listenerId },
    data: { availability },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  emitHostStatusChanged({
    listenerId,
    status: availability,
    availability,
    isEnabled: updated.isEnabled,
    updatedAt: updated.updatedAt,
    reason: 'LISTENER_SELF_STATUS',
  });

  return updated;
};

const mapRecentSession = (session, type) => {
  const counterparty = type === 'chat' ? session.user : session.user;
  const timestamp =
    session.endedAt ||
    session.startedAt ||
    session.answeredAt ||
    session.requestedAt ||
    session.createdAt;

  return {
    id: session.id,
    type,
    status: session.status,
    timestamp,
    totalAmount: toNumber(session.totalAmount),
    billedMinutes: session.billedMinutes,
    durationSeconds: type === 'call' ? session.durationSeconds : null,
    counterparty: {
      id: counterparty?.id || session.userId,
      displayName: counterparty?.displayName || 'Anonymous User',
      profileImageUrl: counterparty?.profileImageUrl || null,
    },
  };
};

const getListenerDashboard = async (listenerId) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    profile,
    wallet,
    totalEarned,
    todayEarned,
    totalChats,
    totalCalls,
    activeChats,
    activeCalls,
    recentChatSessions,
    recentCallSessions,
    recentEarnings,
  ] = await Promise.all([
    prisma.listenerProfile.findUnique({
      where: { userId: listenerId },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImageUrl: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    }),
    prisma.wallet.findUnique({
      where: { userId: listenerId },
    }),
    prisma.walletTransaction.aggregate({
      where: {
        userId: listenerId,
        type: 'ADMIN_CREDIT',
        status: 'SUCCESS',
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.walletTransaction.aggregate({
      where: {
        userId: listenerId,
        type: 'ADMIN_CREDIT',
        status: 'SUCCESS',
        createdAt: {
          gte: todayStart,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.chatSession.count({
      where: {
        listenerId,
      },
    }),
    prisma.callSession.count({
      where: {
        listenerId,
      },
    }),
    prisma.chatSession.count({
      where: {
        listenerId,
        status: 'ACTIVE',
      },
    }),
    prisma.callSession.count({
      where: {
        listenerId,
        status: {
          in: ['RINGING', 'ACTIVE'],
        },
      },
    }),
    prisma.chatSession.findMany({
      where: {
        listenerId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
    }),
    prisma.callSession.findMany({
      where: {
        listenerId,
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 5,
    }),
    prisma.walletTransaction.findMany({
      where: {
        userId: listenerId,
        type: 'ADMIN_CREDIT',
        status: 'SUCCESS',
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 8,
    }),
  ]);

  if (!profile || !profile.user) {
    throw new AppError('Listener profile not found', 404, 'LISTENER_NOT_FOUND');
  }

  const recentSessions = [
    ...recentChatSessions.map((item) => mapRecentSession(item, 'chat')),
    ...recentCallSessions.map((item) => mapRecentSession(item, 'call')),
  ]
    .sort((left, right) => new Date(right.timestamp || 0).getTime() - new Date(left.timestamp || 0).getTime())
    .slice(0, 8);

  return {
    listener: {
      id: profile.userId,
      displayName: profile.user.displayName,
      profileImageUrl: profile.user.profileImageUrl,
      availability: profile.availability,
      isEnabled: profile.isEnabled,
      onboardingCompleted: profile.onboardingCompleted,
      verificationStatus: profile.verificationStatus,
      verificationNote: profile.verificationNote,
      submittedAt: profile.submittedAt,
      reviewedAt: profile.reviewedAt,
      chatRatePerMinute: toNumber(profile.chatRatePerMinute),
      callRatePerMinute: toNumber(profile.callRatePerMinute),
    },
    balance: toNumber(wallet?.balance || 0),
    currency: wallet?.currency || 'INR',
    totalEarned: toNumber(totalEarned._sum.amount),
    todayEarned: toNumber(todayEarned._sum.amount),
    activeChats,
    activeCalls,
    totalChats,
    totalCalls,
    recentSessions,
    recentEarnings: recentEarnings.map((item) => ({
      id: item.id,
      amount: toNumber(item.amount),
      balanceAfter: toNumber(item.balanceAfter),
      createdAt: item.createdAt,
      description: item.description,
      relatedSessionId: item.relatedSessionId,
      source: item?.metadata?.source || null,
      sessionType: item?.metadata?.sessionType || null,
    })),
  };
};

const getListenerWelcomeMessage = async ({ listenerId }) => {
  await ensureListenerProfile(listenerId);

  const listenerProfile = await prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    select: {
      userId: true,
      welcomeMessage: true,
      updatedAt: true,
    },
  });

  return {
    listenerId: listenerProfile.userId,
    welcomeMessage: listenerProfile.welcomeMessage || '',
    updatedAt: listenerProfile.updatedAt,
  };
};

const updateListenerWelcomeMessage = async ({ listenerId, welcomeMessage }) => {
  await ensureListenerProfile(listenerId);

  const normalizedMessage = String(welcomeMessage || '').trim();
  const updated = await prisma.listenerProfile.update({
    where: { userId: listenerId },
    data: {
      welcomeMessage: normalizedMessage || null,
    },
    select: {
      userId: true,
      welcomeMessage: true,
      updatedAt: true,
    },
  });

  return {
    listenerId: updated.userId,
    welcomeMessage: updated.welcomeMessage || '',
    updatedAt: updated.updatedAt,
  };
};

const listListenerFavourites = async ({ listenerId }) => {
  await ensureListenerProfile(listenerId);

  const favourites = await prisma.listenerFavourite.findMany({
    where: {
      listenerId,
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          profileImageUrl: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const items = favourites
    .filter((item) => item.user && ACTIVE_USER_STATUSES.has(String(item.user.status || '').toUpperCase()))
    .map((item) => ({
      userId: item.user.id,
      displayName: item.user.displayName,
      profileImageUrl: item.user.profileImageUrl || null,
      favouritedAt: item.createdAt,
    }));

  return {
    items,
    total: items.length,
  };
};

const addListenerFavourite = async ({ listenerId, userId }) => {
  await ensureListenerProfile(listenerId);

  if (listenerId === userId) {
    throw new AppError('Cannot favourite yourself', 400, 'INVALID_FAVOURITE_TARGET');
  }

  const targetUser = await ensureTargetUser({ userId });
  if (targetUser.role !== 'USER') {
    throw new AppError('Only user accounts can be favourited', 400, 'INVALID_FAVOURITE_TARGET');
  }

  await prisma.listenerFavourite.upsert({
    where: {
      listenerId_userId: {
        listenerId,
        userId,
      },
    },
    create: {
      listenerId,
      userId,
    },
    update: {},
  });

  return listListenerFavourites({ listenerId });
};

const removeListenerFavourite = async ({ listenerId, userId }) => {
  await ensureListenerProfile(listenerId);

  await prisma.listenerFavourite.deleteMany({
    where: {
      listenerId,
      userId,
    },
  });

  return listListenerFavourites({ listenerId });
};

const listListenerBlockedUsers = async ({ listenerId }) => {
  await ensureListenerProfile(listenerId);

  const blockedItems = await prisma.listenerBlockedUser.findMany({
    where: {
      listenerId,
    },
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          profileImageUrl: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  const items = blockedItems
    .filter((item) => item.user && ACTIVE_USER_STATUSES.has(String(item.user.status || '').toUpperCase()))
    .map((item) => ({
      userId: item.user.id,
      displayName: item.user.displayName,
      profileImageUrl: item.user.profileImageUrl || null,
      blockedAt: item.createdAt,
    }));

  return {
    items,
    total: items.length,
  };
};

const blockUserForListener = async ({ listenerId, userId }) => {
  await ensureListenerProfile(listenerId);

  if (listenerId === userId) {
    throw new AppError('Cannot block yourself', 400, 'INVALID_BLOCK_TARGET');
  }

  const targetUser = await ensureTargetUser({ userId });
  if (targetUser.role !== 'USER') {
    throw new AppError('Only user accounts can be blocked', 400, 'INVALID_BLOCK_TARGET');
  }

  await prisma.listenerBlockedUser.upsert({
    where: {
      listenerId_userId: {
        listenerId,
        userId,
      },
    },
    create: {
      listenerId,
      userId,
    },
    update: {},
  });

  return listListenerBlockedUsers({ listenerId });
};

const unblockUserForListener = async ({ listenerId, userId }) => {
  await ensureListenerProfile(listenerId);

  await prisma.listenerBlockedUser.deleteMany({
    where: {
      listenerId,
      userId,
    },
  });

  return listListenerBlockedUsers({ listenerId });
};

const uploadListenerOnboardingAsset = async ({
  listenerId,
  file,
  assetType,
  governmentIdType,
  userRole,
  hasAuthorizationHeader,
  routePath,
}) => {
  if (!listenerId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!file?.buffer) {
    throw new AppError('Image file is required', 400, 'FILE_MISSING');
  }

  if (!['profile-image', 'government-id'].includes(assetType)) {
    throw new AppError('Unsupported upload type', 400, 'LISTENER_UPLOAD_TYPE_INVALID');
  }

  await ensureListenerProfile(listenerId);

  const normalizedGovernmentIdType = normalizeNullableString(governmentIdType, 120);
  const storagePath = buildListenerOnboardingStoragePath({
    listenerId,
    assetType,
    governmentIdType: normalizedGovernmentIdType,
    mimeType: file.mimetype,
    originalFileName: file.originalname,
  });

  logger.info('[ListenerOnboardingUpload] route hit', {
    route: routePath || null,
    hasAuthorizationHeader: Boolean(hasAuthorizationHeader),
    userId: listenerId,
    role: userRole || null,
    assetType,
    fileName: file?.originalname || null,
    mimeType: file?.mimetype || null,
    sizeBytes: Number(file?.size || 0),
    storagePath,
  });

  const uploadedAsset = await uploadBufferToFirebaseStorage({
    destinationPath: storagePath,
    contentType: file.mimetype,
    originalFileName: file.originalname,
    buffer: file.buffer,
    metadata: {
      listenerId,
      assetType,
      uploadedVia: 'listener_onboarding_api',
    },
  });
  const publicUrl = uploadedAsset.fileUrl;

  try {
    const profile = await prisma.listenerProfile.findUnique({
      where: { userId: listenerId },
      select: {
        userId: true,
        onboardingData: true,
        profileImageRef: true,
        governmentIdImageRef: true,
        governmentIdType: true,
        updatedAt: true,
      },
    });

    if (!profile) {
      throw new AppError('Listener profile not found', 404, 'LISTENER_NOT_FOUND');
    }

    const onboardingData =
      profile.onboardingData && typeof profile.onboardingData === 'object' && !Array.isArray(profile.onboardingData)
        ? { ...profile.onboardingData }
        : {};

    const updateData = {};
    if (assetType === 'profile-image') {
      updateData.profileImageRef = publicUrl;
      onboardingData.profileImageRef = publicUrl;
      onboardingData.profileImageObjectKey = uploadedAsset.objectPath;
    } else {
      updateData.governmentIdImageRef = publicUrl;
      onboardingData.governmentIdImageRef = publicUrl;
      onboardingData.governmentIdImageObjectKey = uploadedAsset.objectPath;
      if (normalizedGovernmentIdType) {
        updateData.governmentIdType = normalizedGovernmentIdType;
        onboardingData.governmentIdType = normalizedGovernmentIdType;
      }
    }

    updateData.onboardingData = onboardingData;

    const [updatedProfile] = await prisma.$transaction(async (tx) => {
      const nextProfile = await tx.listenerProfile.update({
        where: { userId: listenerId },
        data: updateData,
        select: {
          userId: true,
          profileImageRef: true,
          governmentIdImageRef: true,
          governmentIdType: true,
          updatedAt: true,
        },
      });

      if (assetType === 'profile-image') {
        await tx.user.update({
          where: { id: listenerId },
          data: {
            profileImageUrl: publicUrl,
          },
        });
      }

      return [nextProfile];
    });

    if (assetType === 'profile-image') {
      await deleteFromFirebaseStorage(profile.profileImageRef);
    } else {
      await deleteFromFirebaseStorage(profile.governmentIdImageRef);
    }

    return {
      listenerId: updatedProfile.userId,
      assetType,
      fileUrl: publicUrl,
      profileImageRef: updatedProfile.profileImageRef || null,
      governmentIdImageRef: updatedProfile.governmentIdImageRef || null,
      governmentIdType: updatedProfile.governmentIdType || normalizedGovernmentIdType || null,
      updatedAt: updatedProfile.updatedAt,
    };
  } catch (error) {
    logger.error('[ListenerOnboardingUpload] failed', {
      route: routePath || null,
      hasAuthorizationHeader: Boolean(hasAuthorizationHeader),
      userId: listenerId,
      role: userRole || null,
      assetType,
      storagePath,
      uploadObjectPath: uploadedAsset?.objectPath || null,
      errorCode: error?.code || null,
      errorName: error?.name || null,
      message: error?.message || null,
      stack: error?.stack || null,
    });

    await deleteFromFirebaseStorage(uploadedAsset.objectPath);

    if (isSchemaMismatchError(error)) {
      throw new AppError(
        'Upload service is being updated. Please try again shortly.',
        503,
        'DB_SCHEMA_OUT_OF_SYNC'
      );
    }

    throw error;
  }
};

const submitListenerOnboarding = async ({ listenerId, payload = {} }) => {
  await ensureListenerProfile(listenerId);

  const onboardingData = buildOnboardingSnapshot(payload);
  const selectedName = normalizeNullableString(payload.selectedName, 80);
  const displayName = normalizeNullableString(payload.displayName, 80) || selectedName;

  const profileImageRef =
    normalizeNullableString(payload.profileImageRef, 1024) ||
    normalizeNullableString(onboardingData.profileImageRef, 1024);
  const governmentIdType =
    normalizeNullableString(payload.governmentIdType, 120) ||
    normalizeNullableString(onboardingData.governmentIdType, 120);
  const governmentIdImageRef =
    normalizeNullableString(payload.governmentIdImageRef, 1024) ||
    normalizeNullableString(onboardingData.governmentIdImageRef, 1024);

  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    if (displayName) {
      await tx.user.update({
        where: { id: listenerId },
        data: {
          displayName,
        },
      });
    }

    return tx.listenerProfile.update({
      where: { userId: listenerId },
      data: {
        onboardingCompleted: true,
        verificationStatus: 'PENDING_VERIFICATION',
        verificationNote: null,
        submittedAt: now,
        reviewedAt: null,
        reviewedBy: null,
        onboardingData,
        profileImageRef,
        governmentIdType,
        governmentIdImageRef,
        availability: 'OFFLINE',
      },
      select: {
        userId: true,
        onboardingCompleted: true,
        verificationStatus: true,
        verificationNote: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedBy: true,
        onboardingData: true,
        profileImageRef: true,
        governmentIdType: true,
        governmentIdImageRef: true,
      },
    });
  });

  return {
    listenerId: updated.userId,
    onboardingCompleted: updated.onboardingCompleted,
    verificationStatus: updated.verificationStatus,
    verificationNote: updated.verificationNote,
    submittedAt: updated.submittedAt,
    reviewedAt: updated.reviewedAt,
    reviewedBy: updated.reviewedBy,
    onboardingData: updated.onboardingData || {},
    profileImageRef: updated.profileImageRef,
    governmentIdType: updated.governmentIdType,
    governmentIdImageRef: updated.governmentIdImageRef,
  };
};

module.exports = {
  listListeners,
  getListenerById,
  getListenerAvailability,
  updateListenerAvailability,
  getListenerDashboard,
  getListenerWelcomeMessage,
  updateListenerWelcomeMessage,
  listListenerFavourites,
  addListenerFavourite,
  removeListenerFavourite,
  listListenerBlockedUsers,
  blockUserForListener,
  unblockUserForListener,
  uploadListenerOnboardingAsset,
  submitListenerOnboarding,
};
