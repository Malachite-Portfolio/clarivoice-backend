const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { allowRoles } = require('../../middleware/roles');
const { validate } = require('../../middleware/validate');
const controller = require('./admin.controller');
const {
  adminPaginationSchema,
  adminUsersQuerySchema,
  adminKycListQuerySchema,
  adminKycIdParamSchema,
  adminListenersPendingQuerySchema,
  adminListenerIdParamSchema,
  approveKycSchema,
  rejectKycSchema,
  approveListenerApplicationSchema,
  rejectListenerApplicationSchema,
  updateListenerRatesSchema,
  updateListenerStatusSchema,
  updateListenerVisibilitySchema,
  removeListenerSchema,
  manualWalletAdjustmentSchema,
  createRechargePlanSchema,
  updateRechargePlanSchema,
  updateReferralRuleSchema,
} = require('./admin.validator');

const router = express.Router();

router.use(authMiddleware, allowRoles('ADMIN'));

router.get('/dashboard/summary', controller.getDashboardSummary);
router.get('/dashboard/revenue-series', controller.getDashboardRevenueSeries);
router.get('/dashboard/top-hosts', controller.getDashboardTopHosts);
router.get('/dashboard/recent-sessions', controller.getDashboardRecentSessions);
router.get('/dashboard/recent-recharges', controller.getDashboardRecentRecharges);

router.get('/users', validate(adminUsersQuerySchema, 'query'), controller.listUsers);
router.get('/listeners', validate(adminPaginationSchema, 'query'), controller.listListeners);
router.get('/listeners/pending', validate(adminListenersPendingQuerySchema, 'query'), controller.listPendingListeners);
router.get('/listeners/:id', validate(adminListenerIdParamSchema, 'params'), controller.getListenerById);

router.get('/kyc', validate(adminKycListQuerySchema, 'query'), controller.listKycSubmissions);
router.get('/kyc/:id', validate(adminKycIdParamSchema, 'params'), controller.getKycSubmissionById);
router.post(
  '/kyc/:id/approve',
  validate(adminKycIdParamSchema, 'params'),
  validate(approveKycSchema),
  controller.approveKycSubmission
);
router.post(
  '/kyc/:id/reject',
  validate(adminKycIdParamSchema, 'params'),
  validate(rejectKycSchema),
  controller.rejectKycSubmission
);

router.patch(
  '/listeners/:id/approve',
  validate(adminListenerIdParamSchema, 'params'),
  validate(approveListenerApplicationSchema),
  controller.approveListenerApplication
);
router.patch(
  '/listeners/:id/reject',
  validate(adminListenerIdParamSchema, 'params'),
  validate(rejectListenerApplicationSchema),
  controller.rejectListenerApplication
);
router.patch('/listeners/:id/rates', validate(updateListenerRatesSchema), controller.updateListenerRates);
router.patch('/listeners/:id/status', validate(updateListenerStatusSchema), controller.updateListenerStatus);
router.patch('/listeners/:id/visibility', validate(updateListenerVisibilitySchema), controller.updateListenerVisibility);
router.post('/listeners/:id/remove', validate(removeListenerSchema), controller.removeListenerSoft);

router.get('/wallet/ledger', controller.listWalletLedger);
router.post('/wallet/adjust', validate(manualWalletAdjustmentSchema), controller.manualWalletAdjustment);

router.get('/sessions/chat', validate(adminPaginationSchema, 'query'), controller.listChatSessions);
router.get('/sessions/call', validate(adminPaginationSchema, 'query'), controller.listCallSessions);

router.get('/recharge-plans', controller.listRechargePlans);
router.post('/recharge-plans', validate(createRechargePlanSchema), controller.createRechargePlan);
router.patch('/recharge-plans/:id', validate(updateRechargePlanSchema), controller.updateRechargePlan);

router.get('/referral-rule', controller.getReferralRule);
router.patch('/referral-rule', validate(updateReferralRuleSchema), controller.updateReferralRule);

module.exports = router;
