const { prisma } = require('../../config/prisma');
const { AppError } = require('../../utils/appError');

const REQUIRED_KYC_DOCUMENT_FIELDS = ['aadhaarFrontUrl', 'aadhaarBackUrl', 'selfieUrl'];
const KYC_SAFE_SELECT = {
  status: true,
  fullName: true,
  aadhaarLast4: true,
  dob: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  aadhaarFrontUrl: true,
  aadhaarBackUrl: true,
  selfieUrl: true,
};

const getMissingDocumentFields = (kycRecord = {}) =>
  REQUIRED_KYC_DOCUMENT_FIELDS.filter(
    (fieldName) => !String(kycRecord?.[fieldName] || '').trim()
  );

const mapKycRecordToSafeResponse = (kycRecord) => {
  if (!kycRecord) {
    return { status: 'NOT_STARTED' };
  }

  const missingDocumentFields = getMissingDocumentFields(kycRecord);
  if (missingDocumentFields.length > 0) {
    return {
      status: 'DRAFT',
      fullName: kycRecord.fullName || null,
      aadhaarLast4: kycRecord.aadhaarLast4 || null,
      dob: kycRecord.dob || null,
      submittedAt: kycRecord.submittedAt || null,
      reviewedAt: kycRecord.reviewedAt || null,
      reviewNote: kycRecord.reviewNote || null,
      aadhaarFrontUrl: kycRecord.aadhaarFrontUrl || null,
      aadhaarBackUrl: kycRecord.aadhaarBackUrl || null,
      selfieUrl: kycRecord.selfieUrl || null,
    };
  }

  const normalizedStatus = String(kycRecord.status || 'DRAFT').toUpperCase();
  const status =
    normalizedStatus === 'PENDING' ||
    normalizedStatus === 'APPROVED' ||
    normalizedStatus === 'REJECTED'
      ? normalizedStatus
      : 'DRAFT';

  return {
    status,
    fullName: kycRecord.fullName || null,
    aadhaarLast4: kycRecord.aadhaarLast4 || null,
    dob: kycRecord.dob || null,
    submittedAt: kycRecord.submittedAt || null,
    reviewedAt: kycRecord.reviewedAt || null,
    reviewNote: kycRecord.reviewNote || null,
    aadhaarFrontUrl: kycRecord.aadhaarFrontUrl || null,
    aadhaarBackUrl: kycRecord.aadhaarBackUrl || null,
    selfieUrl: kycRecord.selfieUrl || null,
  };
};

const getMyKyc = async ({ userId }) => {
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const kycRecord = await prisma.kycVerification.findUnique({
    where: { userId },
    select: KYC_SAFE_SELECT,
  });

  return mapKycRecordToSafeResponse(kycRecord);
};

const submitKyc = async ({ userId, payload }) => {
  if (!userId) {
    throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const normalizedFullName = String(payload?.fullName || '').trim();
  const normalizedAadhaarLast4 = String(payload?.aadhaarLast4 || '').trim();
  const normalizedDob = String(payload?.dob || '').trim();

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    let kycRecord = await tx.kycVerification.findUnique({
      where: { userId },
    });

    if (!kycRecord) {
      kycRecord = await tx.kycVerification.create({
        data: {
          userId,
          status: 'DRAFT',
        },
      });
    }

    if (kycRecord.status === 'APPROVED') {
      throw new AppError(
        'KYC is already approved and cannot be resubmitted.',
        409,
        'KYC_ALREADY_APPROVED'
      );
    }

    const missingDocumentFields = getMissingDocumentFields(kycRecord);
    if (missingDocumentFields.length > 0) {
      throw new AppError(
        'Required KYC documents are missing. Upload Aadhaar front, Aadhaar back, and selfie before submitting.',
        400,
        'KYC_DOCUMENTS_MISSING',
        { missingFields: missingDocumentFields }
      );
    }

    const updated = await tx.kycVerification.update({
      where: { userId },
      data: {
        status: 'PENDING',
        submittedAt: now,
        reviewedAt: null,
        reviewNote: null,
        fullName: normalizedFullName,
        aadhaarLast4: normalizedAadhaarLast4,
        dob: normalizedDob,
      },
      select: {
        status: true,
      },
    });

    return {
      message: 'KYC submitted successfully',
      status: updated.status,
    };
  });
};

module.exports = {
  getMyKyc,
  submitKyc,
};
