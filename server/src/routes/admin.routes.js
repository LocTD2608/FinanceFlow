const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

// Tất cả các route admin đều được bảo vệ bởi [auth, requireRole('admin')]
router.use(auth, requireRole('admin'));

// 1. Thống kê hệ thống
router.get('/metrics', adminController.getMetrics);

// 2. Quản lý người dùng
router.get('/users', adminController.getUsers);
router.patch('/users/:id/status', adminController.updateUserStatus);
router.patch('/users/:id/role', adminController.updateUserRole);

// 3. Quản lý danh mục hệ thống
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

module.exports = router;
