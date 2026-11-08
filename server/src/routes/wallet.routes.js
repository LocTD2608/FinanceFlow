const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/wallet.controller');

const router = express.Router();

router.use(auth);

router.get('/', ctrl.list);
router.get('/default', ctrl.getDefault);
router.get('/suggest-account', ctrl.suggestAccount);
router.post('/check-account', ctrl.checkAccount);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', ctrl.update);
router.post('/:id/set-account', ctrl.setAccount);
router.delete('/:id', ctrl.remove);

module.exports = router;
