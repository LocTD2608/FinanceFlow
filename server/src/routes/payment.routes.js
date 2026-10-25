const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/payment.controller');

const router = express.Router();

router.use(auth);

router.post('/intent', ctrl.createIntent);
router.post('/intent/:id/resend', ctrl.resendOtp);
router.post('/intent/:id/confirm', ctrl.confirmIntent);

module.exports = router;
