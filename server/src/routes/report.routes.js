const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/report.controller');

const router = express.Router();

router.use(auth);

router.get('/daily', ctrl.getDailyReport);

module.exports = router;
