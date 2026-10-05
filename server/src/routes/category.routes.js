const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/category.controller');

const router = express.Router();

router.use(auth);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
