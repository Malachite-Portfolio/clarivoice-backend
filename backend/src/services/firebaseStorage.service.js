const { randomUUID } = require('crypto');
const { env } = require('../config/env');
const { logger } = require('../config/logger');
const { getFirebaseAdminApp } = require('../config/firebaseAdmin');
const { AppError } = require('../utils/appError');

const CONTENT_TYPE_EXTENSION_MAP = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const normalizeMimeType = (mimeType = '') => {
  return String(mimeType || '')
    .trim()
    .toLowerCase();
};

const extensionFromMimeType = (mimeType = '') => {
  return CONTENT_TYPE_EXTENSION_MAP[normalizeMimeType(mimeType)] || '';
};

const extensionFromFileName = (fileName = '') => {
  const normalized = String(fileName || '')
    .trim()
    .toLowerCase()
    .replace(/[?#].*$/, '');
  if (!normalized || !normalized.includes('.')) {
    return '';
  }
  const extension = normalized.split('.').pop();
  return extension || '';
};

const normalizeStoragePath = ({ destinationPath, mimeType, originalFileName }) => {
  const normalizedPath = String(destinationPath || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/{2,}/g, '/');

  if (!normalizedPath) {
    throw new AppError('Upload path is required', 500, 'FIREBASE_UPLOAD_FAILED');
  }

  if (/\.[a-z0-9]+$/i.test(normalizedPath)) {
    return normalizedPath;
  }

  const extension =
    extensionFromMimeType(mimeType) || extensionFromFileName(originalFileName) || 'jpg';
  return `${normalizedPath}.${extension}`;
};

const encodeObjectPathForGoogleStorageUrl = (objectPath) => {
  return String(objectPath || '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
};

const ensureFirebaseBucketName = () => {
  const bucketName = String(env.FIREBASE_STORAGE_BUCKET || '').trim();
  if (!bucketName) {
    throw new AppError(
      'Firebase Storage bucket is not configured',
      500,
      'FIREBASE_STORAGE_NOT_CONFIGURED'
    );
  }
  return bucketName;
};

const getFirebaseBucket = () => {
  const bucketName = ensureFirebaseBucketName();
  const app = getFirebaseAdminApp();
  return {
    bucketName,
    bucket: app.storage().bucket(bucketName),
  };
};

const buildFirebaseDownloadUrl = ({ bucketName, objectPath, downloadToken }) => {
  const encodedPath = encodeURIComponent(String(objectPath || ''));
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${downloadToken}`;
};

const uploadBufferToFirebaseStorage = async ({
  buffer,
  contentType,
  destinationPath,
  originalFileName,
  metadata,
}) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError('File is required', 400, 'FILE_MISSING');
  }

  const normalizedMimeType = normalizeMimeType(contentType) || 'application/octet-stream';
  const objectPath = normalizeStoragePath({
    destinationPath,
    mimeType: normalizedMimeType,
    originalFileName,
  });

  const { bucketName, bucket } = getFirebaseBucket();
  const file = bucket.file(objectPath);
  const downloadToken = randomUUID();

  logger.info('[FirebaseStorage] upload start', {
    bucket: bucketName,
    objectPath,
    mimeType: normalizedMimeType,
    sizeBytes: buffer.length,
  });

  try {
    await file.save(buffer, {
      resumable: false,
      contentType: normalizedMimeType,
      metadata: {
        cacheControl: env.FIREBASE_STORAGE_CACHE_CONTROL,
        metadata: {
          ...(metadata || {}),
          firebaseStorageDownloadTokens: downloadToken,
        },
      },
    });
  } catch (error) {
    logger.error('[FirebaseStorage] upload failed', {
      bucket: bucketName,
      objectPath,
      mimeType: normalizedMimeType,
      sizeBytes: buffer.length,
      errorCode: error?.code || null,
      errorName: error?.name || null,
      reason: error instanceof Error ? error.message : String(error),
      stack: error?.stack || null,
    });
    throw new AppError('Failed to upload file to Firebase Storage', 500, 'FIREBASE_UPLOAD_FAILED', {
      bucket: bucketName,
      objectPath,
      errorCode: error?.code || null,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  const fileUrl = buildFirebaseDownloadUrl({
    bucketName,
    objectPath,
    downloadToken,
  });

  return {
    bucket: bucketName,
    objectPath,
    objectKey: objectPath,
    gsUri: `gs://${bucketName}/${objectPath}`,
    fileUrl,
    downloadUrl: fileUrl,
    publicUrl: fileUrl,
    fallbackPublicUrl: `https://storage.googleapis.com/${bucketName}/${encodeObjectPathForGoogleStorageUrl(
      objectPath
    )}`,
  };
};

const resolveObjectPathFromReference = (reference, currentBucketName) => {
  const normalizedReference = String(reference || '').trim();
  if (!normalizedReference) {
    return null;
  }

  if (normalizedReference.startsWith('/uploads/')) {
    return null;
  }

  if (normalizedReference.startsWith('gs://')) {
    const withoutPrefix = normalizedReference.slice('gs://'.length);
    const separatorIndex = withoutPrefix.indexOf('/');
    if (separatorIndex < 0) {
      return null;
    }
    const bucketName = withoutPrefix.slice(0, separatorIndex);
    if (currentBucketName && bucketName !== currentBucketName) {
      return null;
    }
    return decodeURIComponent(withoutPrefix.slice(separatorIndex + 1));
  }

  if (/^https?:\/\//i.test(normalizedReference)) {
    try {
      const parsedUrl = new URL(normalizedReference);
      const hostname = String(parsedUrl.hostname || '').toLowerCase();
      const pathname = String(parsedUrl.pathname || '');

      if (hostname === 'firebasestorage.googleapis.com') {
        const pathMatch = pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
        if (!pathMatch) {
          return null;
        }
        const bucketName = decodeURIComponent(pathMatch[1]);
        if (currentBucketName && bucketName !== currentBucketName) {
          return null;
        }
        return decodeURIComponent(pathMatch[2]);
      }

      if (hostname === 'storage.googleapis.com') {
        const segments = pathname.split('/').filter(Boolean);
        if (segments.length < 2) {
          return null;
        }
        const bucketName = decodeURIComponent(segments[0]);
        if (currentBucketName && bucketName !== currentBucketName) {
          return null;
        }
        return decodeURIComponent(segments.slice(1).join('/'));
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  return normalizedReference.replace(/^\/+/, '');
};

const deleteFromFirebaseStorage = async (reference) => {
  const bucketName = String(env.FIREBASE_STORAGE_BUCKET || '').trim();
  if (!bucketName) {
    return;
  }

  const objectPath = resolveObjectPathFromReference(reference, bucketName);
  if (!objectPath) {
    return;
  }

  try {
    const app = getFirebaseAdminApp();
    const bucket = app.storage().bucket(bucketName);
    await bucket.file(objectPath).delete({ ignoreNotFound: true });
    logger.info('[FirebaseStorage] deleted old object', {
      bucket: bucketName,
      objectPath,
    });
  } catch (error) {
    logger.warn('[FirebaseStorage] failed to delete object', {
      bucket: bucketName,
      objectPath,
      reason: error instanceof Error ? error.message : String(error),
    });
  }
};

module.exports = {
  uploadBufferToFirebaseStorage,
  deleteFromFirebaseStorage,
  normalizeStoragePath,
};
