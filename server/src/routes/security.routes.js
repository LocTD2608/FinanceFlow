const express = require('express');
const auth = require('../middleware/auth');
const ctrl = require('../controllers/security.controller');

const router = express.Router();

// Bảo vệ tất cả route bằng middleware xác thực JWT
router.use(auth);

// 1. Kiểm tra trạng thái mã PIN và sinh trắc học
router.get('/status', ctrl.getPinStatus);

// 2. Thiết lập mã PIN lần đầu
router.post('/setup', ctrl.setupPin);

// 3. Xác thực mã PIN (kiểm tra brute-force)
router.post('/verify', ctrl.verifyPin);

// 4. Đổi mã PIN
router.post('/change', ctrl.changePin);

// 5. Yêu cầu gửi OTP khôi phục mã PIN về Email
router.post('/forgot', ctrl.forgotPin);

// 6. Đặt lại mã PIN bằng mã OTP Email
router.post('/reset-with-otp', ctrl.resetPinWithOtp);

// 7. Bật / tắt xác thực sinh trắc học
router.post('/biometric/toggle', ctrl.toggleBiometric);

module.exports = router;
