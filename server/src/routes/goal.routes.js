const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/goal.controller');

const router = express.Router();

router.use(auth);

router.get('/', ctrl.list);
router.get('/pending-decision', ctrl.getPendingDecision);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', ctrl.update);
router.post('/:id/extend', ctrl.extend);
router.post('/:id/expire-close', ctrl.expireClose);
router.post('/:id/contributions', ctrl.contribute);
router.get('/:id/contributions', ctrl.listContributions);
router.post('/:id/cancel', ctrl.cancel);

module.exports = router;
