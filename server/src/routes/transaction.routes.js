const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/transaction.controller');

const router = express.Router();

router.use(auth);

router.post('/', ctrl.create);

module.exports = router;
