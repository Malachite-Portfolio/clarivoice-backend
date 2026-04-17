const express = require('express');
const controller = require('./listeners.controller');
const { validate } = require('../../middleware/validate');
const { authMiddleware } = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/roles');
const { listenerImageUploadMiddleware } = require('./listeners.upload');
const {
  listListenersQuerySchema,
  updateAvailabilitySchema,
  updateWelcomeMessageSchema,
  listenerUserParamSchema,
  submitOnboardingSchema,
} = require('./listeners.validator');

const router = express.Router();

router.get('/', validate(listListenersQuerySchema, 'query'), controller.getListeners);
router.get(
  '/me/dashboard',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  controller.getMyDashboard
);
router.get(
  '/me/availability',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  controller.getMyAvailability
);
router.post(
  '/me/availability',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  validate(updateAvailabilitySchema),
  controller.updateMyAvailability
);
router.get(
  '/me/welcome-message',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  controller.getMyWelcomeMessage
);
router.patch(
  '/me/welcome-message',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  validate(updateWelcomeMessageSchema),
  controller.updateMyWelcomeMessage
);
router.get(
  '/me/favourites',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  controller.getMyFavourites
);
router.post(
  '/me/favourites/:userId',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  validate(listenerUserParamSchema, 'params'),
  controller.addMyFavourite
);
router.delete(
  '/me/favourites/:userId',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  validate(listenerUserParamSchema, 'params'),
  controller.removeMyFavourite
);
router.get(
  '/me/blocked',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  controller.getMyBlockedUsers
);
router.post(
  '/me/blocked/:userId',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  validate(listenerUserParamSchema, 'params'),
  controller.blockUser
);
router.delete(
  '/me/blocked/:userId',
  authMiddleware,
  allowRoles('LISTENER', 'ADMIN'),
  validate(listenerUserParamSchema, 'params'),
  controller.unblockUser
);
router.post(
  '/me/onboarding/submit',
  authMiddleware,
  allowRoles('LISTENER'),
  validate(submitOnboardingSchema),
  controller.submitMyOnboarding
);
router.post(
  '/me/uploads/profile-image',
  authMiddleware,
  allowRoles('LISTENER'),
  listenerImageUploadMiddleware,
  controller.uploadMyProfileImage
);
router.post(
  '/me/uploads/government-id',
  authMiddleware,
  allowRoles('LISTENER'),
  listenerImageUploadMiddleware,
  controller.uploadMyGovernmentId
);
router.get('/:id', controller.getListener);
router.get('/:id/availability', controller.getAvailability);

module.exports = router;
