const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/billReminder.controller');

const router = express.Router();

router.use(auth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/pay', ctrl.pay);

module.exports = router;
