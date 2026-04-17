const { prisma } = require('../../config/prisma');
const { logger } = require('../../config/logger');
const {
  uploadBufferToFirebaseStorage,
  deleteFromFirebaseStorage,
} = require('../../services/firebaseStorage.service');
const { AppError } = require('../../utils/appError');

const USER_INCLUDE = {
  wallet: true,
  settings: true,
  listenerProfile: true,
  referralCode: true,
};

const PROFILE_AVATAR_EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const getImageExtensionByMimeType = (mimeType = '', fileName = '') => {
  const normalizedMimeType = String(mimeType || '')
    .trim()
    .toLowerCase();

  if (PROFILE_AVATAR_EXTENSION_BY_MIME_TYPE[normalizedMimeType]) {
    return PROFILE_AVATAR_EXTENSION_BY_MIME_TYPE[normalizedMimeType];
  }

  const normalizedFileName = String(fileName || '')
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, '');
  if (normalizedFileName.includes('.')) {
    const extension = normalizedFileName.split('.').pop();
    if (extension) {
      return extension;
    }
  }

  return 'jpg';
};

const buildProfileAvatarStoragePath = (userId, file) => {
  const extension = getImageExtensionByMimeType(file?.mimetype, file?.originalname);
  const timestamp = Date.now();
  return `profile/${userId}/profile-${timestamp}.${extension}`;
};

const getMyProfile = async (userId) => {
  return prisma.user.findUnique({
    where: { id: userId },
    include: USER_INCLUDE,
  });
};

const updateMyProfile = async (userId, payload) => {
  return prisma.user.update({
    where: { id: userId },
    data: payload,
    include: USER_INCLUDE,
  });
};

const uploadProfileAvatar = async (userId, file, _requestMeta = {}) => {
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  if (!file?.buffer) {
    throw new AppError('Avatar image is required.', 400, 'FILE_MISSING');
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    include: USER_INCLUDE,
  });

  if (!currentUser) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  const storagePath = buildProfileAvatarStoragePath(userId, file);
  logger.info('[Profile] avatar upload route hit', {
    userId,
    role: currentUser.role,
    fileName: file?.originalname || null,
    mimeType: file?.mimetype || null,
    sizeBytes: Number(file?.size || 0) || null,
    storagePath,
  });

  const uploadedAvatar = await uploadBufferToFirebaseStorage({
    destinationPath: storagePath,
    contentType: file?.mimetype,
    originalFileName: file?.originalname,
    buffer: file.buffer,
    metadata: {
      userId,
      uploadType: 'profile_avatar',
    },
  });

  try {
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        profileImageUrl: uploadedAvatar.fileUrl,
      },
      include: USER_INCLUDE,
    });

    await deleteFromFirebaseStorage(currentUser?.profileImageUrl);
    return updatedUser;
  } catch (error) {
    await deleteFromFirebaseStorage(uploadedAvatar.objectPath);
    throw error;
  }
};

const softDeleteAccount = async (userId) => {
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        status: 'DELETED',
        deletedAt: new Date(),
      },
    });

    await tx.authSession.updateMany({
      where: {
        userId,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    await tx.listenerProfile.updateMany({
      where: { userId },
      data: {
        availability: 'OFFLINE',
        isEnabled: false,
      },
    });
  });
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  uploadProfileAvatar,
  softDeleteAccount,
};
