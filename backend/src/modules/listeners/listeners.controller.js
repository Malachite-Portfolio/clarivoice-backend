const { StatusCodes } = require('http-status-codes');
const { asyncHandler } = require('../../utils/asyncHandler');
const { successResponse, errorResponse } = require('../../utils/apiResponse');
const { env } = require('../../config/env');
const listenerService = require('./listeners.service');

const logUploadRequest = (label, req) => {
  console.info(`[ListenerUploads] ${label}`, {
    route: req?.originalUrl || req?.url || null,
    hasAuthorizationHeader: Boolean(req?.headers?.authorization),
    userId: req?.user?.id || null,
    role: req?.user?.role || null,
    fileName: req?.file?.originalname || null,
    mimeType: req?.file?.mimetype || null,
    sizeBytes: Number(req?.file?.size || 0) || null,
    firebaseStorageBucket: String(env?.FIREBASE_STORAGE_BUCKET || '').trim() || null,
  });
};

const getListeners = asyncHandler(async (req, res) => {
  const data = await listenerService.listListeners(req.query);
  return successResponse(res, data);
});

const getListener = asyncHandler(async (req, res) => {
  const data = await listenerService.getListenerById(req.params.id);
  if (!data) {
    return errorResponse(res, 'Listener not found', 'LISTENER_NOT_FOUND', StatusCodes.NOT_FOUND);
  }

  return successResponse(res, data);
});

const getAvailability = asyncHandler(async (req, res) => {
  const data = await listenerService.getListenerAvailability(req.params.id);

  if (!data) {
    return errorResponse(res, 'Listener not found', 'LISTENER_NOT_FOUND', StatusCodes.NOT_FOUND);
  }

  return successResponse(res, data);
});

const getMyAvailability = asyncHandler(async (req, res) => {
  const data = await listenerService.getListenerAvailability(req.user.id);

  if (!data) {
    return errorResponse(res, 'Listener not found', 'LISTENER_NOT_FOUND', StatusCodes.NOT_FOUND);
  }

  return successResponse(res, data);
});

const getMyDashboard = asyncHandler(async (req, res) => {
  const data = await listenerService.getListenerDashboard(req.user.id);
  return successResponse(res, data);
});

const updateMyAvailability = asyncHandler(async (req, res) => {
  const data = await listenerService.updateListenerAvailability({
    listenerId: req.user.id,
    availability: req.body.availability,
  });

  return successResponse(res, data, 'Listener availability updated');
});

const getMyWelcomeMessage = asyncHandler(async (req, res) => {
  const data = await listenerService.getListenerWelcomeMessage({
    listenerId: req.user.id,
  });

  return successResponse(res, data);
});

const updateMyWelcomeMessage = asyncHandler(async (req, res) => {
  const data = await listenerService.updateListenerWelcomeMessage({
    listenerId: req.user.id,
    welcomeMessage: req.body.welcomeMessage,
  });

  return successResponse(res, data, 'Welcome message updated');
});

const getMyFavourites = asyncHandler(async (req, res) => {
  const data = await listenerService.listListenerFavourites({
    listenerId: req.user.id,
  });

  return successResponse(res, data);
});

const addMyFavourite = asyncHandler(async (req, res) => {
  const data = await listenerService.addListenerFavourite({
    listenerId: req.user.id,
    userId: req.params.userId,
  });

  return successResponse(res, data, 'Favourite added');
});

const removeMyFavourite = asyncHandler(async (req, res) => {
  const data = await listenerService.removeListenerFavourite({
    listenerId: req.user.id,
    userId: req.params.userId,
  });

  return successResponse(res, data, 'Favourite removed');
});

const getMyBlockedUsers = asyncHandler(async (req, res) => {
  const data = await listenerService.listListenerBlockedUsers({
    listenerId: req.user.id,
  });

  return successResponse(res, data);
});

const blockUser = asyncHandler(async (req, res) => {
  const data = await listenerService.blockUserForListener({
    listenerId: req.user.id,
    userId: req.params.userId,
  });

  return successResponse(res, data, 'User blocked');
});

const unblockUser = asyncHandler(async (req, res) => {
  const data = await listenerService.unblockUserForListener({
    listenerId: req.user.id,
    userId: req.params.userId,
  });

  return successResponse(res, data, 'User unblocked');
});

const submitMyOnboarding = asyncHandler(async (req, res) => {
  const data = await listenerService.submitListenerOnboarding({
    listenerId: req.user.id,
    payload: req.body,
  });

  return successResponse(res, data, 'Onboarding submitted for verification');
});

const uploadMyProfileImage = asyncHandler(async (req, res) => {
  logUploadRequest('profile-image:request', req);
  const data = await listenerService.uploadListenerOnboardingAsset({
    listenerId: req.user.id,
    file: req.file,
    assetType: 'profile-image',
    userRole: req?.user?.role,
    hasAuthorizationHeader: Boolean(req?.headers?.authorization),
    routePath: req?.originalUrl || req?.url || null,
  });

  console.info('[ListenerUploads] profile-image:success', {
    userId: req?.user?.id || null,
    fileUrl: data?.fileUrl || null,
  });

  return successResponse(res, data, 'Profile image uploaded');
});

const uploadMyGovernmentId = asyncHandler(async (req, res) => {
  logUploadRequest('government-id:request', req);
  const data = await listenerService.uploadListenerOnboardingAsset({
    listenerId: req.user.id,
    file: req.file,
    assetType: 'government-id',
    governmentIdType: req.body?.governmentIdType,
    userRole: req?.user?.role,
    hasAuthorizationHeader: Boolean(req?.headers?.authorization),
    routePath: req?.originalUrl || req?.url || null,
  });

  console.info('[ListenerUploads] government-id:success', {
    userId: req?.user?.id || null,
    fileUrl: data?.fileUrl || null,
    governmentIdType: data?.governmentIdType || null,
  });

  return successResponse(res, data, 'Government ID uploaded');
});

module.exports = {
  getListeners,
  getListener,
  getAvailability,
  getMyAvailability,
  getMyDashboard,
  updateMyAvailability,
  getMyWelcomeMessage,
  updateMyWelcomeMessage,
  getMyFavourites,
  addMyFavourite,
  removeMyFavourite,
  getMyBlockedUsers,
  blockUser,
  unblockUser,
  submitMyOnboarding,
  uploadMyProfileImage,
  uploadMyGovernmentId,
};
