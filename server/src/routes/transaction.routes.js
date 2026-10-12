const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/transaction.controller');

const router = express.Router();

// Yêu cầu xác thực JWT cho tất cả thao tác giao dịch
router.use(auth);

router.get('/summary', ctrl.summary);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
