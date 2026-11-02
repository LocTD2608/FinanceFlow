const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/p2p.controller');

const router = express.Router();

router.use(auth);

// Tra cứu người nhận
router.get('/lookup', ctrl.lookupRecipient);

// Chuyển tiền P2P
router.post('/transfer', ctrl.transfer);
router.post('/transfers', ctrl.transfer);

// Lịch sử giao dịch P2P
router.get('/transfers', ctrl.listTransfers);
router.get('/transfers/:id', ctrl.getTransferById);

module.exports = router;
