const express = require('express');
const { authMiddleware } = require('../../middleware/auth');
const { validate } = require('../../middleware/validate');
const controller = require('./kyc.controller');
const { submitKycSchema } = require('./kyc.validator');

const router = express.Router();

router.get('/me', authMiddleware, controller.getMyKyc);
router.post('/submit', authMiddleware, validate(submitKycSchema), controller.submitKyc);

module.exports = router;
