const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/wallet.controller');

const router = express.Router();

router.use(auth);

router.get('/', ctrl.list);
router.get('/default', ctrl.getDefault);
router.post('/', ctrl.create);

module.exports = router;
