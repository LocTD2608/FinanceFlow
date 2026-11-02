const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/goal.controller');

const router = express.Router();

router.use(auth);

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', ctrl.update);
router.post('/:id/contributions', ctrl.contribute);
router.get('/:id/contributions', ctrl.listContributions);
router.post('/:id/cancel', ctrl.cancel);

module.exports = router;
