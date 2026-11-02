const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/p2p.controller');

const router = express.Router();

router.use(auth);

router.get('/lookup', ctrl.lookup);
router.post('/transfers', ctrl.transfer);
router.get('/transfers', ctrl.listTransfers);
router.get('/transfers/:id', ctrl.getTransferById);

module.exports = router;
