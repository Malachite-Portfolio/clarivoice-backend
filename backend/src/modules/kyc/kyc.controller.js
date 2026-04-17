const { asyncHandler } = require('../../utils/asyncHandler');
const { successResponse } = require('../../utils/apiResponse');
const kycService = require('./kyc.service');

const getMyKyc = asyncHandler(async (req, res) => {
  const data = await kycService.getMyKyc({
    userId: req?.user?.id,
  });

  return successResponse(res, data);
});

const submitKyc = asyncHandler(async (req, res) => {
  const data = await kycService.submitKyc({
    userId: req?.user?.id,
    payload: req.body,
  });

  return successResponse(res, data, data.message);
});

module.exports = {
  getMyKyc,
  submitKyc,
};
