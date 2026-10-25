const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Đăng ký
router.post('/register', authController.register);

// Đăng nhập truyền thống (email/phone/username + password)
router.post('/login', authController.login);

// Đăng nhập mạng xã hội (Google, Apple, Facebook)
router.post('/social-login', authController.socialLogin);

// Lấy thông tin user hiện tại
router.get('/me', authController.getMe);

module.exports = router;
