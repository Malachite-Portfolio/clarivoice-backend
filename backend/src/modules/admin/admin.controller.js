const { asyncHandler } = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/apiResponse');
const adminService = require('./admin.service');

const getDashboardSummary = asyncHandler(async (_req, res) => {
  const data = await adminService.getDashboardSummary();
  return successResponse(res, data);
});

const getDashboardRevenueSeries = asyncHandler(async (_req, res) => {
  const data = await adminService.getDashboardRevenueSeries();
  return successResponse(res, data);
});

const getDashboardTopHosts = asyncHandler(async (_req, res) => {
  const data = await adminService.getDashboardTopHosts();
  return successResponse(res, data);
});

const getDashboardRecentSessions = asyncHandler(async (_req, res) => {
  const data = await adminService.getDashboardRecentSessions();
  return successResponse(res, data);
});

const getDashboardRecentRecharges = asyncHandler(async (_req, res) => {
  const data = await adminService.getDashboardRecentRecharges();
  return successResponse(res, data);
});

const listUsers = asyncHandler(async (req, res) => {
  const data = await adminService.listUsers(req.query);
  return successResponse(res, data);
});

const listListeners = asyncHandler(async (req, res) => {
  const data = await adminService.listListeners(req.query);
  return successResponse(res, data);
});

const listPendingListeners = asyncHandler(async (req, res) => {
  const data = await adminService.listPendingListeners({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    search: req.query.search,
  });
  return successResponse(res, data);
});

const listKycSubmissions = asyncHandler(async (req, res) => {
  const data = await adminService.listKycSubmissions({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    status: req.query.status,
    source: req.query.source,
    role: req.query.role,
    search: req.query.search,
  });
  return successResponse(res, data);
});

const getKycSubmissionById = asyncHandler(async (req, res) => {
  const data = await adminService.getKycSubmissionById(req.params.id);
  return successResponse(res, data);
});

const approveKycSubmission = asyncHandler(async (req, res) => {
  const data = await adminService.approveKycSubmission({
    kycId: req.params.id,
    adminId: req.user.id,
    reviewNote: req.body.reviewNote,
  });
  return successResponse(res, data, 'KYC approved');
});

const rejectKycSubmission = asyncHandler(async (req, res) => {
  const data = await adminService.rejectKycSubmission({
    kycId: req.params.id,
    adminId: req.user.id,
    reviewNote: req.body.reviewNote,
  });
  return successResponse(res, data, 'KYC rejected');
});

const getListenerById = asyncHandler(async (req, res) => {
  const data = await adminService.getListenerById(req.params.id);
  return successResponse(res, data);
});

const approveListenerApplication = asyncHandler(async (req, res) => {
  const data = await adminService.approveListenerApplication({
    listenerId: req.params.id,
    adminId: req.user.id,
    note: req.body.note,
  });
  return successResponse(res, data, 'Listener approved');
});

const rejectListenerApplication = asyncHandler(async (req, res) => {
  const data = await adminService.rejectListenerApplication({
    listenerId: req.params.id,
    adminId: req.user.id,
    note: req.body.note,
  });
  return successResponse(res, data, 'Listener rejected');
});

const updateListenerRates = asyncHandler(async (req, res) => {
  const data = await adminService.updateListenerRates({
    listenerId: req.params.id,
    ...req.body,
  });
  return successResponse(res, data, 'Listener rates updated');
});

const updateListenerStatus = asyncHandler(async (req, res) => {
  const data = await adminService.updateListenerStatus({
    listenerId: req.params.id,
    payload: req.body,
  });
  return successResponse(res, data, 'Listener status updated');
});

const updateListenerVisibility = asyncHandler(async (req, res) => {
  const data = await adminService.updateListenerVisibility({
    listenerId: req.params.id,
    visible: req.body.visible,
  });
  return successResponse(res, data, 'Listener visibility updated');
});

const removeListenerSoft = asyncHandler(async (req, res) => {
  const data = await adminService.removeListenerSoft({
    listenerId: req.params.id,
    adminId: req.user.id,
    reason: req.body.reason,
  });
  return successResponse(res, data, 'Listener removed successfully');
});

const listWalletLedger = asyncHandler(async (req, res) => {
  const data = await adminService.listWalletLedger({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
    userId: req.query.userId,
  });
  return successResponse(res, data);
});

const listChatSessions = asyncHandler(async (req, res) => {
  const data = await adminService.listChatSessions({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
  });
  return successResponse(res, data);
});

const listCallSessions = asyncHandler(async (req, res) => {
  const data = await adminService.listCallSessions({
    page: Number(req.query.page || 1),
    limit: Number(req.query.limit || 20),
  });
  return successResponse(res, data);
});

const manualWalletAdjustment = asyncHandler(async (req, res) => {
  const data = await adminService.manualWalletAdjustment({
    ...req.body,
    adminId: req.user.id,
  });
  return successResponse(res, data, 'Wallet adjusted successfully');
});

const listRechargePlans = asyncHandler(async (_req, res) => {
  const data = await adminService.listRechargePlans();
  return successResponse(res, { plans: data });
});

const createRechargePlan = asyncHandler(async (req, res) => {
  const data = await adminService.createRechargePlan(req.body);
  return successResponse(res, data, 'Recharge plan created');
});

const updateRechargePlan = asyncHandler(async (req, res) => {
  const data = await adminService.updateRechargePlan({
    id: Number(req.params.id),
    payload: req.body,
  });
  return successResponse(res, data, 'Recharge plan updated');
});

const getReferralRule = asyncHandler(async (_req, res) => {
  const data = await adminService.getReferralRule();
  return successResponse(res, data);
});

const updateReferralRule = asyncHandler(async (req, res) => {
  const data = await adminService.updateReferralRule(req.body);
  return successResponse(res, data, 'Referral rule updated');
});

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
