const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/netWorth.controller');

const router = express.Router();

router.use(auth);

router.get('/trend', ctrl.trend);
router.post('/snapshot', ctrl.snapshot);

module.exports = router;
