const { prisma } = require('../../config/prisma');
const walletService = require('../../services/wallet.service');
const callService = require('../call/call.service');
const chatService = require('../chat/chat.service');
const { AppError } = require('../../utils/appError');
const { DEMO_ACCOUNT_PHONE_VALUES, isDemoAccountPhone } = require('../../utils/demoAccounts');
const {
  SYNC_EVENTS,
  emitEvent,
  buildHostSyncPayload,
} = require('../../services/realtimeSync.service');

const forceEndActiveSessionsForListener = async ({ listenerId, reasonCode }) => {
  const [activeCallSessions, activeChatSessions] = await Promise.all([
    prisma.callSession.findMany({
      where: {
        listenerId,
        status: { in: ['ACTIVE', 'RINGING', 'REQUESTED'] },
      },
      select: { id: true },
    }),
    prisma.chatSession.findMany({
      where: {
        listenerId,
        status: { in: ['ACTIVE', 'REQUESTED'] },
      },
      select: { id: true },
    }),
  ]);

  await Promise.all([
    ...activeCallSessions.map((session) =>
      callService.forceEndCallBySystem({
        sessionId: session.id,
        endReason: 'CANCELLED',
        reasonCode,
        restoreListenerAvailability: false,
      })
    ),
    ...activeChatSessions.map((session) =>
      chatService.forceEndChatBySystem({
        sessionId: session.id,
        endReason: 'CANCELLED',
        reasonCode,
        restoreListenerAvailability: false,
      })
    ),
  ]);
};

const LISTENER_APPLICATION_INCLUDE = {
  user: {
    select: {
      id: true,
      phone: true,
      email: true,
      displayName: true,
      profileImageUrl: true,
      status: true,
      isPhoneVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  },
};

const normalizeVerificationStatus = (status) => String(status || 'DRAFT').toUpperCase();

const mapListenerApplication = (profile) => ({
  id: profile.userId,
  listenerId: profile.userId,
  onboardingCompleted: Boolean(profile.onboardingCompleted),
  verificationStatus: normalizeVerificationStatus(profile.verificationStatus),
  verificationNote: profile.verificationNote || null,
  submittedAt: profile.submittedAt || null,
  reviewedAt: profile.reviewedAt || null,
  reviewedBy: profile.reviewedBy || null,
  profileImageRef: profile.profileImageRef || null,
  governmentIdType: profile.governmentIdType || null,
  governmentIdImageRef: profile.governmentIdImageRef || null,
  onboardingData: profile.onboardingData || {},
  listener: {
    id: profile.user?.id || profile.userId,
    displayName: profile.user?.displayName || profile.user?.phone || profile.userId,
    phone: profile.user?.phone || null,
    email: profile.user?.email || null,
    profileImageUrl: profile.user?.profileImageUrl || null,
    status: profile.user?.status || null,
    isPhoneVerified: Boolean(profile.user?.isPhoneVerified),
    createdAt: profile.user?.createdAt || null,
  },
  rates: {
    callRatePerMinute: Number(profile.callRatePerMinute || 0),
    chatRatePerMinute: Number(profile.chatRatePerMinute || 0),
  },
  availability: profile.availability,
  isEnabled: Boolean(profile.isEnabled),
  category: profile.category || null,
  languages: profile.languages || [],
  experienceYears: Number(profile.experienceYears || 0),
  rating: Number(profile.rating || 0),
  updatedAt: profile.updatedAt,
});

const KYC_SAFE_DETAIL_INCLUDE = {
  user: {
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      displayName: true,
      profileImageUrl: true,
      status: true,
      listenerProfile: {
        select: {
          category: true,
          languages: true,
          onboardingData: true,
          profileImageRef: true,
          governmentIdType: true,
          governmentIdImageRef: true,
          verificationStatus: true,
          verificationNote: true,
          submittedAt: true,
          reviewedAt: true,
          reviewedBy: true,
        },
      },
    },
  },
};

const LISTENER_KYC_DETAIL_INCLUDE = {
  user: {
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      displayName: true,
      profileImageUrl: true,
    },
  },
};

const LISTENER_KYC_LIST_INCLUDE = {
  user: {
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      displayName: true,
      profileImageUrl: true,
      listenerProfile: {
        select: {
          category: true,
          languages: true,
          onboardingData: true,
          profileImageRef: true,
          governmentIdType: true,
          governmentIdImageRef: true,
        },
      },
    },
  },
};

const KYC_SOURCE = {
  KYC_VERIFICATION: 'KYC_VERIFICATION',
  LISTENER_ONBOARDING: 'LISTENER_ONBOARDING',
};

const LISTENER_KYC_ID_PREFIX = 'listener_';

const normalizeListenerVerificationStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (
    normalized === 'DRAFT' ||
    normalized === 'PENDING_VERIFICATION' ||
    normalized === 'APPROVED' ||
    normalized === 'REJECTED'
  ) {
    return normalized;
  }
  return 'DRAFT';
};

const mapListenerVerificationToKycStatus = (status) => {
  const normalized = normalizeListenerVerificationStatus(status);
  if (normalized === 'PENDING_VERIFICATION') {
    return 'PENDING';
  }
  if (normalized === 'APPROVED') {
    return 'APPROVED';
  }
  if (normalized === 'REJECTED') {
    return 'REJECTED';
  }
  return 'DRAFT';
};

const mapKycStatusToListenerVerification = (status) => {
  const normalized = normalizeKycStatus(status);
  if (normalized === 'PENDING') {
    return 'PENDING_VERIFICATION';
  }
  if (normalized === 'APPROVED') {
    return 'APPROVED';
  }
  if (normalized === 'REJECTED') {
    return 'REJECTED';
  }
  return 'DRAFT';
};

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const endOfDay = (value) => {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
};

const startOfDay = (value) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
};

const formatDayLabel = (value) =>
  new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short' }).format(value);

const mapRealtimeSessionStatus = ({ status, endReason }) => {
  const normalizedStatus = String(status || '').trim().toUpperCase();
  const normalizedReason = String(endReason || '').trim().toUpperCase();

  if (normalizedStatus === 'ACTIVE') {
    return 'active';
  }

  if (normalizedStatus === 'RINGING' || normalizedStatus === 'REQUESTED') {
    return 'ringing';
  }

  if (
    normalizedStatus === 'CANCELLED' ||
    normalizedStatus === 'REJECTED' ||
    normalizedStatus === 'MISSED'
  ) {
    return 'cancelled';
  }

  if (normalizedReason === 'INSUFFICIENT_BALANCE') {
    return 'insufficient_balance';
  }

  return 'ended';
};

const resolveSessionStartTime = (session = {}) =>
  session.startedAt ||
  session.answeredAt ||
  session.requestedAt ||
  session.createdAt ||
  new Date().toISOString();

const computeRunningDurationSeconds = ({ startTime, endTime }) => {
  const startMs = new Date(startTime).getTime();
  const endMs = new Date(endTime || Date.now()).getTime();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / 1000);
};

const extractPaymentMethod = (metadata) => {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  return (
    String(metadata.paymentMethod || metadata.method || metadata.provider || '').trim() || null
  );
};

const normalizeDateValue = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
};

const getSortTimestamp = (record) => {
  const submitted = normalizeDateValue(record.submittedAt);
  const updated = normalizeDateValue(record.updatedAt);
  const created = normalizeDateValue(record.createdAt);
  const candidate = submitted || updated || created;
  if (!candidate) {
    return 0;
  }
  return new Date(candidate).getTime();
};

const withListenerKycId = (userId) => `${LISTENER_KYC_ID_PREFIX}${userId}`;

const parseKycIdentifier = (inputId) => {
  const raw = String(inputId || '').trim();
  if (raw.startsWith(LISTENER_KYC_ID_PREFIX)) {
    return {
      source: KYC_SOURCE.LISTENER_ONBOARDING,
      recordId: raw.slice(LISTENER_KYC_ID_PREFIX.length),
    };
  }

  return {
    source: KYC_SOURCE.KYC_VERIFICATION,
    recordId: raw,
  };
};

const readOnboardingField = (profile, ...keys) => {
  const source = profile?.onboardingData;
  if (!source || typeof source !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = source?.[key];
    if (value === null || value === undefined) {
      continue;
    }
    const normalized = String(value).trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const normalizeKycStatus = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (
    normalized === 'DRAFT' ||
    normalized === 'PENDING' ||
    normalized === 'APPROVED' ||
    normalized === 'REJECTED'
  ) {
    return normalized;
  }
  return 'DRAFT';
};

const mapKycListItem = (record) => ({
  id: record.id,
  submissionId: record.id,
  userId: record.userId,
  hostListenerId:
    String(record.user?.role || '').toUpperCase() === 'LISTENER' ? record.userId : null,
  source: KYC_SOURCE.KYC_VERIFICATION,
  fullName:
    String(record.fullName || '').trim() ||
    String(record.user?.displayName || '').trim() ||
    null,
  phone: record.user?.phone || null,
  email: record.user?.email || null,
  profilePhotoUrl:
    record.user?.listenerProfile?.profileImageRef || record.user?.profileImageUrl || null,
  role: String(record.user?.role || '').toUpperCase() || null,
  category: record.user?.listenerProfile?.category || null,
  languages: Array.isArray(record.user?.listenerProfile?.languages)
    ? record.user.listenerProfile.languages
    : [],
  status: normalizeKycStatus(record.status),
  submittedAt: record.submittedAt || null,
  reviewedAt: record.reviewedAt || null,
  createdAt: record.createdAt || null,
  updatedAt: record.updatedAt || null,
});

const mapKycDetail = (record) => ({
  ...mapKycListItem(record),
  aadhaarLast4: record.aadhaarLast4 || null,
  dob: record.dob || null,
  reviewNote: record.reviewNote || null,
  aadhaarFrontUrl: record.aadhaarFrontUrl || record.user?.listenerProfile?.governmentIdImageRef || null,
  aadhaarBackUrl: record.aadhaarBackUrl || null,
  selfieUrl:
    record.selfieUrl ||
    record.user?.listenerProfile?.profileImageRef ||
    record.user?.profileImageUrl ||
    null,
  governmentIdUrl: record.user?.listenerProfile?.governmentIdImageRef || null,
  governmentIdType: record.user?.listenerProfile?.governmentIdType || null,
  onboardingData: record.user?.listenerProfile?.onboardingData || null,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  listenerVerificationStatus:
    record.user?.listenerProfile?.verificationStatus || null,
  listenerVerificationNote: record.user?.listenerProfile?.verificationNote || null,
});

const mapListenerProfileToKycListItem = (profile) => ({
  id: withListenerKycId(profile.userId),
  submissionId: profile.id,
  userId: profile.userId,
  hostListenerId: profile.userId,
  source: KYC_SOURCE.LISTENER_ONBOARDING,
  fullName:
    readOnboardingField(profile, 'selectedName', 'fullName') ||
    String(profile.user?.displayName || '').trim() ||
    null,
  phone: profile.user?.phone || null,
  email: profile.user?.email || null,
  profilePhotoUrl: profile.profileImageRef || profile.user?.profileImageUrl || null,
  role: String(profile.user?.role || '').toUpperCase() || 'LISTENER',
  category: profile.category || null,
  languages: Array.isArray(profile.languages) ? profile.languages : [],
  status: mapListenerVerificationToKycStatus(profile.verificationStatus),
  submittedAt: profile.submittedAt || null,
  reviewedAt: profile.reviewedAt || null,
  createdAt: profile.createdAt || null,
  updatedAt: profile.updatedAt || null,
});

const mapListenerProfileToKycDetail = (profile) => ({
  ...mapListenerProfileToKycListItem(profile),
  aadhaarLast4: readOnboardingField(profile, 'aadhaarLast4'),
  dob: readOnboardingField(profile, 'dob', 'dateOfBirth'),
  reviewNote: profile.verificationNote || null,
  aadhaarFrontUrl: profile.governmentIdImageRef || null,
  aadhaarBackUrl: readOnboardingField(profile, 'aadhaarBackUrl', 'governmentIdBackImageRef'),
  selfieUrl: profile.profileImageRef || profile.user?.profileImageUrl || null,
  governmentIdUrl: profile.governmentIdImageRef || null,
  governmentIdType: profile.governmentIdType || null,
  onboardingData: profile.onboardingData || null,
  createdAt: profile.createdAt,
  updatedAt: profile.updatedAt,
  listenerVerificationStatus: normalizeListenerVerificationStatus(profile.verificationStatus),
  listenerVerificationNote: profile.verificationNote || null,
});

const getListenerKycSubmissionByUserId = async (listenerUserId) => {
  const listenerProfile = await prisma.listenerProfile.findUnique({
    where: { userId: listenerUserId },
    include: LISTENER_KYC_DETAIL_INCLUDE,
  });

  if (!listenerProfile) {
    return null;
  }

  return mapListenerProfileToKycDetail(listenerProfile);
};

const listKycSubmissions = async ({ page, limit, status, source, role, search }) => {
  const skip = (page - 1) * limit;
  const normalizedStatus = String(status || 'ALL').trim().toUpperCase();
  const normalizedSource = String(source || 'ALL').trim().toUpperCase();
  const normalizedRole = String(role || 'ALL').trim().toUpperCase();
  const normalizedSearch = String(search || '').trim();

  const roleFilter =
    normalizedRole !== 'ALL' &&
    (normalizedRole === 'LISTENER' || normalizedRole === 'USER' || normalizedRole === 'ADMIN')
      ? normalizedRole
      : null;

  const buildUserFilters = () => ({
    phone: {
      notIn: DEMO_ACCOUNT_PHONE_VALUES,
    },
    ...(roleFilter
      ? {
          role: roleFilter,
        }
      : {}),
  });

  const kycWhere = {
    ...(normalizedStatus && normalizedStatus !== 'ALL'
      ? {
          status: normalizeKycStatus(normalizedStatus),
        }
      : {}),
    user: buildUserFilters(),
    ...(normalizedSearch
      ? {
          OR: [
            {
              fullName: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
            {
              user: {
                displayName: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                phone: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                email: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }
      : {}),
  };

  const listenerWhere = {
    ...(normalizedStatus && normalizedStatus !== 'ALL'
      ? {
          verificationStatus: mapKycStatusToListenerVerification(normalizedStatus),
        }
      : {}),
    user: buildUserFilters(),
    ...(normalizedSearch
      ? {
          OR: [
            {
              user: {
                displayName: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                phone: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                email: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              category: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  };

  const includeKyc = normalizedSource === 'ALL' || normalizedSource === KYC_SOURCE.KYC_VERIFICATION;
  const includeListener =
    normalizedSource === 'ALL' || normalizedSource === KYC_SOURCE.LISTENER_ONBOARDING;
  const windowSize = skip + limit;

  const [kycItems, listenerItems, kycTotal, listenerTotal] = await Promise.all([
    includeKyc
      ? prisma.kycVerification.findMany({
          where: kycWhere,
          take: windowSize,
          orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
          include: LISTENER_KYC_LIST_INCLUDE,
        })
      : Promise.resolve([]),
    includeListener
      ? prisma.listenerProfile.findMany({
          where: listenerWhere,
          take: windowSize,
          orderBy: [{ submittedAt: 'desc' }, { updatedAt: 'desc' }],
          include: LISTENER_KYC_LIST_INCLUDE,
        })
      : Promise.resolve([]),
    includeKyc ? prisma.kycVerification.count({ where: kycWhere }) : Promise.resolve(0),
    includeListener ? prisma.listenerProfile.count({ where: listenerWhere }) : Promise.resolve(0),
  ]);

  const mergedItems = [
    ...kycItems.map(mapKycListItem),
    ...listenerItems.map(mapListenerProfileToKycListItem),
  ]
    .sort((left, right) => {
      const rightTime = getSortTimestamp(right);
      const leftTime = getSortTimestamp(left);
      if (rightTime !== leftTime) {
        return rightTime - leftTime;
      }
      return String(right.id).localeCompare(String(left.id));
    })
    .slice(skip, skip + limit);

  const total = kycTotal + listenerTotal;

  return {
    items: mergedItems,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getKycSubmissionById = async (kycId) => {
  const parsed = parseKycIdentifier(kycId);
  if (parsed.source === KYC_SOURCE.LISTENER_ONBOARDING) {
    const listenerRecord = await getListenerKycSubmissionByUserId(parsed.recordId);
    if (!listenerRecord) {
      throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
    }
    return listenerRecord;
  }

  const kycRecord = await prisma.kycVerification.findUnique({
    where: { id: parsed.recordId },
    include: KYC_SAFE_DETAIL_INCLUDE,
  });

  if (!kycRecord) {
    const listenerRecord = await getListenerKycSubmissionByUserId(parsed.recordId);
    if (listenerRecord) {
      return listenerRecord;
    }
    throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
  }

  return mapKycDetail(kycRecord);
};

const approveKycSubmission = async ({ kycId, adminId, reviewNote }) => {
  const parsed = parseKycIdentifier(kycId);
  if (parsed.source === KYC_SOURCE.LISTENER_ONBOARDING) {
    const existingListenerRecord = await getListenerKycSubmissionByUserId(parsed.recordId);
    if (!existingListenerRecord) {
      throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
    }
    if (existingListenerRecord.status !== 'PENDING') {
      throw new AppError(
        'Only pending submissions can be approved',
        409,
        'KYC_REVIEW_STATE_INVALID'
      );
    }

    await approveListenerApplication({
      listenerId: parsed.recordId,
      adminId,
      note: reviewNote,
    });
    const listenerRecord = await getListenerKycSubmissionByUserId(parsed.recordId);
    if (!listenerRecord) {
      throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
    }
    return listenerRecord;
  }

  const normalizedReviewNote = String(reviewNote || '').trim();
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.kycVerification.findUnique({
      where: { id: parsed.recordId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!existing) {
      throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
    }
    if (normalizeKycStatus(existing.status) !== 'PENDING') {
      throw new AppError(
        'Only pending submissions can be approved',
        409,
        'KYC_REVIEW_STATE_INVALID'
      );
    }

    const nextRecord = await tx.kycVerification.update({
      where: { id: parsed.recordId },
      data: {
        status: 'APPROVED',
        reviewedAt: now,
        reviewNote: normalizedReviewNote || null,
      },
      include: KYC_SAFE_DETAIL_INCLUDE,
    });

    if (String(existing.user?.role || '').toUpperCase() === 'LISTENER') {
      await tx.listenerProfile.updateMany({
        where: {
          userId: existing.user.id,
        },
        data: {
          verificationStatus: 'APPROVED',
          verificationNote: normalizedReviewNote || null,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });
    }

    return nextRecord;
  });

  return mapKycDetail(updated);
};

const rejectKycSubmission = async ({ kycId, adminId, reviewNote }) => {
  const parsed = parseKycIdentifier(kycId);
  const normalizedReviewNote = String(reviewNote || '').trim();
  const now = new Date();

  if (!normalizedReviewNote) {
    throw new AppError('Rejection reason is required', 400, 'KYC_REJECTION_REASON_REQUIRED');
  }

  if (parsed.source === KYC_SOURCE.LISTENER_ONBOARDING) {
    const existingListenerRecord = await getListenerKycSubmissionByUserId(parsed.recordId);
    if (!existingListenerRecord) {
      throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
    }
    if (existingListenerRecord.status !== 'PENDING') {
      throw new AppError(
        'Only pending submissions can be rejected',
        409,
        'KYC_REVIEW_STATE_INVALID'
      );
    }

    await rejectListenerApplication({
      listenerId: parsed.recordId,
      adminId,
      note: normalizedReviewNote,
    });
    const listenerRecord = await getListenerKycSubmissionByUserId(parsed.recordId);
    if (!listenerRecord) {
      throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
    }
    return listenerRecord;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.kycVerification.findUnique({
      where: { id: parsed.recordId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (!existing) {
      throw new AppError('KYC submission not found', 404, 'KYC_SUBMISSION_NOT_FOUND');
    }
    if (normalizeKycStatus(existing.status) !== 'PENDING') {
      throw new AppError(
        'Only pending submissions can be rejected',
        409,
        'KYC_REVIEW_STATE_INVALID'
      );
    }

    const nextRecord = await tx.kycVerification.update({
      where: { id: parsed.recordId },
      data: {
        status: 'REJECTED',
        reviewedAt: now,
        reviewNote: normalizedReviewNote,
      },
      include: KYC_SAFE_DETAIL_INCLUDE,
    });

    if (String(existing.user?.role || '').toUpperCase() === 'LISTENER') {
      await tx.listenerProfile.updateMany({
        where: {
          userId: existing.user.id,
        },
        data: {
          verificationStatus: 'REJECTED',
          verificationNote: normalizedReviewNote,
          reviewedAt: now,
          reviewedBy: adminId,
        },
      });
    }

    return nextRecord;
  });

  return mapKycDetail(updated);
};

const getDashboardSummary = async () => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const baseUserFilter = {
    phone: {
      notIn: DEMO_ACCOUNT_PHONE_VALUES,
    },
  };

  const [
    totalUsers,
    totalHosts,
    activeHosts,
    liveCalls,
    liveChats,
    pendingHostApprovals,
    rechargeTodayAggregate,
    callRevenueTodayAggregate,
    chatRevenueTodayAggregate,
  ] = await Promise.all([
    prisma.user.count({
      where: {
        ...baseUserFilter,
        role: 'USER',
      },
    }),
    prisma.listenerProfile.count({
      where: {
        user: baseUserFilter,
      },
    }),
    prisma.listenerProfile.count({
      where: {
        isEnabled: true,
        verificationStatus: 'APPROVED',
        user: {
          ...baseUserFilter,
          status: 'ACTIVE',
        },
      },
    }),
    prisma.callSession.count({
      where: {
        status: {
          in: ['ACTIVE', 'RINGING'],
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
    }),
    prisma.chatSession.count({
      where: {
        status: {
          in: ['ACTIVE', 'REQUESTED'],
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
    }),
    prisma.listenerProfile.count({
      where: {
        verificationStatus: 'PENDING_VERIFICATION',
        user: baseUserFilter,
      },
    }),
    prisma.walletTransaction.aggregate({
      _sum: {
        amount: true,
      },
      where: {
        type: 'RECHARGE',
        status: 'SUCCESS',
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        user: baseUserFilter,
      },
    }),
    prisma.callSession.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: 'ENDED',
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
    }),
    prisma.chatSession.aggregate({
      _sum: {
        totalAmount: true,
      },
      where: {
        status: 'ENDED',
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
    }),
  ]);

  const rechargeToday = toNumber(rechargeTodayAggregate?._sum?.amount, 0);
  const callRevenueToday = toNumber(callRevenueTodayAggregate?._sum?.totalAmount, 0);
  const chatRevenueToday = toNumber(chatRevenueTodayAggregate?._sum?.totalAmount, 0);

  return {
    totalUsers,
    totalHosts,
    activeHosts,
    liveCalls,
    liveChats,
    liveCallsNow: liveCalls,
    liveChatsNow: liveChats,
    rechargeToday,
    revenueToday: callRevenueToday + chatRevenueToday,
    pendingHostApprovals,
    pendingWithdrawals: 0,
  };
};

const getDashboardRevenueSeries = async () => {
  const now = new Date();
  const rangeStart = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
  const baseUserFilter = {
    phone: {
      notIn: DEMO_ACCOUNT_PHONE_VALUES,
    },
  };

  const [callRows, chatRows, rechargeRows] = await Promise.all([
    prisma.callSession.findMany({
      where: {
        status: 'ENDED',
        createdAt: {
          gte: rangeStart,
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
      select: {
        createdAt: true,
        billedMinutes: true,
        totalAmount: true,
      },
    }),
    prisma.chatSession.findMany({
      where: {
        status: 'ENDED',
        createdAt: {
          gte: rangeStart,
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
      select: {
        createdAt: true,
        billedMinutes: true,
        totalAmount: true,
      },
    }),
    prisma.walletTransaction.findMany({
      where: {
        type: 'RECHARGE',
        status: 'SUCCESS',
        createdAt: {
          gte: rangeStart,
        },
        user: baseUserFilter,
      },
      select: {
        createdAt: true,
        amount: true,
      },
    }),
  ]);

  const buckets = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const bucketDate = startOfDay(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000));
    const key = bucketDate.toISOString().slice(0, 10);
    buckets.push({
      key,
      date: bucketDate,
      label: formatDayLabel(bucketDate),
      revenue: 0,
      recharge: 0,
      callMinutes: 0,
      chatSessions: 0,
    });
  }

  const bucketByKey = new Map(buckets.map((item) => [item.key, item]));

  callRows.forEach((row) => {
    const key = startOfDay(row.createdAt).toISOString().slice(0, 10);
    const bucket = bucketByKey.get(key);
    if (!bucket) {
      return;
    }
    bucket.revenue += toNumber(row.totalAmount, 0);
    bucket.callMinutes += Number(row.billedMinutes || 0);
  });

  chatRows.forEach((row) => {
    const key = startOfDay(row.createdAt).toISOString().slice(0, 10);
    const bucket = bucketByKey.get(key);
    if (!bucket) {
      return;
    }
    bucket.revenue += toNumber(row.totalAmount, 0);
    bucket.chatSessions += 1;
  });

  rechargeRows.forEach((row) => {
    const key = startOfDay(row.createdAt).toISOString().slice(0, 10);
    const bucket = bucketByKey.get(key);
    if (!bucket) {
      return;
    }
    bucket.recharge += toNumber(row.amount, 0);
  });

  return buckets.map((item) => ({
    label: item.label,
    revenue: Number(item.revenue.toFixed(2)),
    recharge: Number(item.recharge.toFixed(2)),
    callMinutes: item.callMinutes,
    chatSessions: item.chatSessions,
  }));
};

const getDashboardTopHosts = async () => {
  const baseUserFilter = {
    phone: {
      notIn: DEMO_ACCOUNT_PHONE_VALUES,
    },
  };
  const rangeStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [callRows, chatRows] = await Promise.all([
    prisma.callSession.findMany({
      where: {
        status: 'ENDED',
        createdAt: {
          gte: rangeStart,
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
      select: {
        listenerId: true,
        totalAmount: true,
      },
    }),
    prisma.chatSession.findMany({
      where: {
        status: 'ENDED',
        createdAt: {
          gte: rangeStart,
        },
        user: baseUserFilter,
        listener: baseUserFilter,
      },
      select: {
        listenerId: true,
        totalAmount: true,
      },
    }),
  ]);

  const totalsByListener = new Map();
  [...callRows, ...chatRows].forEach((row) => {
    const listenerId = String(row.listenerId || '').trim();
    if (!listenerId) {
      return;
    }
    const previous = totalsByListener.get(listenerId) || 0;
    totalsByListener.set(listenerId, previous + toNumber(row.totalAmount, 0));
  });

  const listenerIds = Array.from(totalsByListener.keys());
  if (listenerIds.length === 0) {
    return [];
  }

  const listenerUsers = await prisma.user.findMany({
    where: {
      id: {
        in: listenerIds,
      },
      role: 'LISTENER',
      phone: {
        notIn: DEMO_ACCOUNT_PHONE_VALUES,
      },
    },
    select: {
      id: true,
      displayName: true,
      phone: true,
    },
  });

  const listenerById = new Map(listenerUsers.map((item) => [item.id, item]));

  return Array.from(totalsByListener.entries())
    .filter(([listenerId]) => listenerById.has(listenerId))
    .map(([listenerId, amount]) => {
      const listener = listenerById.get(listenerId);
      return {
        hostName: listener?.displayName || listener?.phone || listenerId,
        amount: Number(amount.toFixed(2)),
      };
    })
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
};

const getDashboardRecentSessions = async () => {
  const baseUserFilter = {
    phone: {
      notIn: DEMO_ACCOUNT_PHONE_VALUES,
    },
  };

  const [callRows, chatRows] = await Promise.all([
    prisma.callSession.findMany({
      where: {
        user: baseUserFilter,
        listener: baseUserFilter,
      },
      orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true,
          },
        },
        listener: {
          select: {
            id: true,
            displayName: true,
            phone: true,
          },
        },
      },
    }),
    prisma.chatSession.findMany({
      where: {
        user: baseUserFilter,
        listener: baseUserFilter,
      },
      orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            phone: true,
          },
        },
        listener: {
          select: {
            id: true,
            displayName: true,
            phone: true,
          },
        },
      },
    }),
  ]);

  const callItems = callRows.map((item) => {
    const startTime = resolveSessionStartTime(item);
    return {
      id: item.id,
      type: 'call',
      userName: item.user?.displayName || item.user?.phone || item.user?.id || '-',
      hostName:
        item.listener?.displayName || item.listener?.phone || item.listener?.id || '-',
      startTime,
      runningDurationSeconds: computeRunningDurationSeconds({
        startTime,
        endTime: item.endedAt,
      }),
      currentBilling: toNumber(item.totalAmount, 0),
      status: mapRealtimeSessionStatus({
        status: item.status,
        endReason: item.endReason,
      }),
    };
  });

  const chatItems = chatRows.map((item) => {
    const startTime = resolveSessionStartTime(item);
    return {
      id: item.id,
      type: 'chat',
      userName: item.user?.displayName || item.user?.phone || item.user?.id || '-',
      hostName:
        item.listener?.displayName || item.listener?.phone || item.listener?.id || '-',
      startTime,
      runningDurationSeconds: computeRunningDurationSeconds({
        startTime,
        endTime: item.endedAt,
      }),
      currentBilling: toNumber(item.totalAmount, 0),
      status: mapRealtimeSessionStatus({
        status: item.status,
        endReason: item.endReason,
      }),
    };
  });

  return [...callItems, ...chatItems]
    .sort((left, right) => new Date(right.startTime).getTime() - new Date(left.startTime).getTime())
    .slice(0, 10);
};

const getDashboardRecentRecharges = async () => {
  const baseUserFilter = {
    phone: {
      notIn: DEMO_ACCOUNT_PHONE_VALUES,
    },
  };

  const rows = await prisma.walletTransaction.findMany({
    where: {
      type: 'RECHARGE',
      status: 'SUCCESS',
      user: baseUserFilter,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 10,
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          phone: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    userName: row.user?.displayName || row.user?.phone || row.user?.id || '-',
    userId: row.userId,
    type: 'recharge',
    amount: toNumber(row.amount, 0),
    status: 'success',
    balanceBefore: toNumber(row.balanceBefore, 0),
    balanceAfter: toNumber(row.balanceAfter, 0),
    paymentMethod: extractPaymentMethod(row.metadata),
    createdAt: row.createdAt,
  }));
};

const listUsers = async ({ page, limit, search, status }) => {
  const skip = (page - 1) * limit;
  const normalizedSearch = String(search || '').trim();
  const normalizedStatus = String(status || 'ALL').trim().toUpperCase();
  const where = {
    phone: {
      notIn: DEMO_ACCOUNT_PHONE_VALUES,
    },
    ...(normalizedStatus !== 'ALL'
      ? {
          status: normalizedStatus,
        }
      : {}),
    ...(normalizedSearch
      ? {
          OR: [
            {
              displayName: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
            {
              phone: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
            {
              email: {
                contains: normalizedSearch,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        wallet: true,
        listenerProfile: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const listListeners = async ({ page, limit }) => {
  const skip = (page - 1) * limit;
  const where = {
    user: {
      phone: {
        notIn: DEMO_ACCOUNT_PHONE_VALUES,
      },
    },
  };

  const [items, total] = await Promise.all([
    prisma.listenerProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        user: true,
      },
    }),
    prisma.listenerProfile.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const listPendingListeners = async ({ page, limit, search }) => {
  const skip = (page - 1) * limit;
  const normalizedSearch = String(search || '').trim();

  const where = {
    verificationStatus: 'PENDING_VERIFICATION',
    user: {
      phone: {
        notIn: DEMO_ACCOUNT_PHONE_VALUES,
      },
    },
    ...(normalizedSearch
      ? {
          OR: [
            {
              user: {
                displayName: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
            {
              user: {
                phone: {
                  contains: normalizedSearch,
                  mode: 'insensitive',
                },
              },
            },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.listenerProfile.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ submittedAt: 'asc' }, { updatedAt: 'asc' }],
      include: LISTENER_APPLICATION_INCLUDE,
    }),
    prisma.listenerProfile.count({ where }),
  ]);

  return {
    items: items.map(mapListenerApplication),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const getListenerById = async (listenerId) => {
  const listener = await prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    include: LISTENER_APPLICATION_INCLUDE,
  });

  if (!listener || isDemoAccountPhone(listener.user?.phone)) {
    throw new AppError('Listener not found', 404, 'LISTENER_NOT_FOUND');
  }

  return mapListenerApplication(listener);
};

const approveListenerApplication = async ({ listenerId, adminId, note }) => {
  const normalizedNote = String(note || '').trim();

  const listener = await prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    include: { user: true },
  });

  if (!listener) {
    throw new AppError('Listener not found', 404, 'LISTENER_NOT_FOUND');
  }

  const updated = await prisma.listenerProfile.update({
    where: { userId: listenerId },
    data: {
      onboardingCompleted: true,
      verificationStatus: 'APPROVED',
      verificationNote: normalizedNote || null,
      reviewedAt: new Date(),
      reviewedBy: adminId,
    },
    include: {
      user: true,
    },
  });

  emitEvent(
    SYNC_EVENTS.HOST_UPDATED,
    buildHostSyncPayload(updated, {
      reason: 'ADMIN_VERIFICATION_APPROVED',
      verificationStatus: 'APPROVED',
    })
  );

  return mapListenerApplication({
    ...updated,
    user: updated.user,
  });
};

const rejectListenerApplication = async ({ listenerId, adminId, note }) => {
  const normalizedNote = String(note || '').trim();

  const listener = await prisma.listenerProfile.findUnique({
    where: { userId: listenerId },
    include: { user: true },
  });

  if (!listener) {
    throw new AppError('Listener not found', 404, 'LISTENER_NOT_FOUND');
  }

  await forceEndActiveSessionsForListener({
    listenerId,
    reasonCode: 'HOST_REJECTED_BY_ADMIN',
  });

  const updated = await prisma.listenerProfile.update({
    where: { userId: listenerId },
    data: {
      verificationStatus: 'REJECTED',
      verificationNote: normalizedNote || 'Application rejected by admin',
      reviewedAt: new Date(),
      reviewedBy: adminId,
      availability: 'OFFLINE',
    },
    include: {
      user: true,
    },
  });

  emitEvent(
    SYNC_EVENTS.HOST_UPDATED,
    buildHostSyncPayload(updated, {
      reason: 'ADMIN_VERIFICATION_REJECTED',
      verificationStatus: 'REJECTED',
      verificationNote: updated.verificationNote || null,
    })
  );

  return mapListenerApplication({
    ...updated,
    user: updated.user,
  });
};

const updateListenerRates = async ({ listenerId, callRatePerMinute, chatRatePerMinute }) => {
  const listener = await prisma.listenerProfile.update({
    where: { userId: listenerId },
    data: {
      callRatePerMinute,
      chatRatePerMinute,
    },
    include: { user: true },
  });

  const payload = buildHostSyncPayload(listener);
  emitEvent(SYNC_EVENTS.PRICING_UPDATED, payload);
  emitEvent(SYNC_EVENTS.HOST_UPDATED, payload);

  return listener;
};

const updateListenerStatus = async ({ listenerId, payload }) => {
  const shouldForceOffline =
    payload.userStatus && payload.userStatus !== 'ACTIVE';

  const shouldForceEndSessions =
    shouldForceOffline ||
    payload.isEnabled === false ||
    payload.availability === 'OFFLINE';

  const data = {
    ...(payload.isEnabled !== undefined ? { isEnabled: payload.isEnabled } : {}),
    ...(payload.availability ? { availability: payload.availability } : {}),
    ...(shouldForceOffline ? { isEnabled: false, availability: 'OFFLINE' } : {}),
  };

  const listener = await prisma.$transaction(async (tx) => {
    if (payload.userStatus) {
      await tx.user.update({
        where: { id: listenerId },
        data: { status: payload.userStatus },
      });
    }

    return tx.listenerProfile.update({
      where: { userId: listenerId },
      data,
      include: { user: true },
    });
  });

  const syncPayload = buildHostSyncPayload(listener, {
    reason: 'ADMIN_STATUS_UPDATE',
  });

  if (shouldForceEndSessions) {
    await forceEndActiveSessionsForListener({
      listenerId,
      reasonCode: 'HOST_DISABLED_BY_ADMIN',
    });
  }

  emitEvent(SYNC_EVENTS.HOST_STATUS_CHANGED, syncPayload);
  emitEvent(SYNC_EVENTS.HOST_UPDATED, syncPayload);

  return listener;
};

const updateListenerVisibility = async ({ listenerId, visible }) => {
  if (!visible) {
    await forceEndActiveSessionsForListener({
      listenerId,
      reasonCode: 'HOST_HIDDEN_BY_ADMIN',
    });
  }

  const listener = await prisma.listenerProfile.update({
    where: { userId: listenerId },
    data: {
      isEnabled: visible,
      ...(visible ? {} : { availability: 'OFFLINE' }),
    },
    include: { user: true },
  });

  const syncPayload = buildHostSyncPayload(listener, {
    reason: visible ? 'ADMIN_SHOW_HOST' : 'ADMIN_HIDE_HOST',
    visible,
  });

  emitEvent(SYNC_EVENTS.HOST_STATUS_CHANGED, syncPayload);
  emitEvent(SYNC_EVENTS.HOST_UPDATED, syncPayload);

  return listener;
};

const removeListenerSoft = async ({ listenerId, adminId, reason }) => {
  await forceEndActiveSessionsForListener({
    listenerId,
    reasonCode: 'HOST_REMOVED_BY_ADMIN',
  });

  const listener = await prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: listenerId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
        blockedReason: reason || 'Removed by admin',
      },
    });

    const updatedProfile = await tx.listenerProfile.update({
      where: { userId: listenerId },
      data: {
        isEnabled: false,
        availability: 'OFFLINE',
      },
      include: { user: true },
    });

    await tx.authSession.updateMany({
      where: { userId: listenerId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });

    return {
      ...updatedProfile,
      user: updatedUser,
    };
  });

  emitEvent(SYNC_EVENTS.HOST_DELETED, {
    listenerId,
    reason: reason || 'Removed by admin',
    removedBy: adminId,
    syncVersion: Date.now(),
  });

  emitEvent(SYNC_EVENTS.HOST_UPDATED, buildHostSyncPayload(listener, { removed: true }));

  return listener;
};

const listWalletLedger = async ({ page, limit, userId }) => {
  const skip = (page - 1) * limit;
  const where = userId ? { userId } : {};

  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { id: true, phone: true, displayName: true },
        },
      },
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const listChatSessions = async ({ page, limit }) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.chatSession.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true } },
        listener: { select: { id: true, displayName: true } },
      },
    }),
    prisma.chatSession.count(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const listCallSessions = async ({ page, limit }) => {
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    prisma.callSession.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, displayName: true } },
        listener: { select: { id: true, displayName: true } },
      },
    }),
    prisma.callSession.count(),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const manualWalletAdjustment = async ({ userId, action, amount, reason, adminId }) => {
  let transaction;
  if (action === 'CREDIT') {
    transaction = await walletService.creditWallet({
      userId,
      amount,
      type: 'ADMIN_CREDIT',
      description: reason,
      metadata: { adminId, action },
      idempotencyKey: `admin-credit:${adminId}:${userId}:${Date.now()}`,
    });
  } else {
    transaction = await walletService.debitWallet({
      userId,
      amount,
      type: 'ADMIN_DEBIT',
      description: reason,
      metadata: { adminId, action },
      idempotencyKey: `admin-debit:${adminId}:${userId}:${Date.now()}`,
    });
  }

  emitEvent(SYNC_EVENTS.WALLET_UPDATED, {
    userId,
    balance: Number(transaction.balanceAfter),
    source: 'admin_adjustment',
    syncVersion: Date.now(),
  });

  return transaction;
};

const listRechargePlans = async () => {
  return prisma.rechargePlan.findMany({
    orderBy: [{ sortOrder: 'asc' }, { amount: 'asc' }],
  });
};

const createRechargePlan = async (payload) => {
  return prisma.rechargePlan.create({ data: payload });
};

const updateRechargePlan = async ({ id, payload }) => {
  return prisma.rechargePlan.update({
    where: { id },
    data: payload,
  });
};

const getReferralRule = async () => {
  let rule = await prisma.referralRewardRule.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (!rule) {
    rule = await prisma.referralRewardRule.create({
      data: {
        name: 'default_referral_rule',
        inviterReward: 55,
        referredReward: 50,
        qualifyingAmount: 500,
        isActive: true,
      },
    });
  }

  return rule;
};

const updateReferralRule = async ({ inviterReward, referredReward, qualifyingAmount }) => {
  const current = await getReferralRule();
  const updatedRule = await prisma.referralRewardRule.update({
    where: { id: current.id },
    data: {
      inviterReward,
      referredReward,
      qualifyingAmount,
      isActive: true,
    },
  });

  emitEvent(SYNC_EVENTS.REFERRAL_UPDATED, {
    inviterReward: Number(updatedRule.inviterReward),
    referredReward: Number(updatedRule.referredReward),
    qualifyingAmount: Number(updatedRule.qualifyingAmount),
    syncVersion: Date.now(),
  });

  return updatedRule;
};

module.exports = {
  getDashboardSummary,
  getDashboardRevenueSeries,
  getDashboardTopHosts,
  getDashboardRecentSessions,
  getDashboardRecentRecharges,
  listUsers,
  listListeners,
  listPendingListeners,
  listKycSubmissions,
  getKycSubmissionById,
  approveKycSubmission,
  rejectKycSubmission,
  getListenerById,
  approveListenerApplication,
  rejectListenerApplication,
  updateListenerRates,
  updateListenerStatus,
  updateListenerVisibility,
  removeListenerSoft,
  listWalletLedger,
  listChatSessions,
  listCallSessions,
  manualWalletAdjustment,
  listRechargePlans,
  createRechargePlan,
  updateRechargePlan,
  getReferralRule,
  updateReferralRule,
};
