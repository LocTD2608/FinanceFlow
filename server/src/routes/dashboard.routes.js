const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/dashboard.controller');

const router = express.Router();

router.use(auth);

router.get('/summary', ctrl.summary);
router.get('/breakdown', ctrl.breakdown);

module.exports = router;
