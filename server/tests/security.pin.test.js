const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Mock auth middleware to supply a controlled req.user
const mockUserHolder = { user: null };

jest.mock('../src/middleware/auth', () => (req, res, next) => {
  req.user = {
    id: mockUserHolder.user ? mockUserHolder.user._id : 'user_test_1',
    email: mockUserHolder.user ? mockUserHolder.user.email : 'user@test.vn',
    role: 'user',
    status: 'active',
  };
  next();
});

// Mock mail service
jest.mock('../src/services/mail.service', () => ({
  sendOtpEmail: jest.fn().mockResolvedValue({ isDev: true, otp: '654321' }),
  maskEmail: jest.fn((email) => 'u***@test.vn'),
}));

const User = require('../src/models/User');
const securityRoutes = require('../src/routes/security.routes');
const mailService = require('../src/services/mail.service');

const app = express();
app.use(express.json());
app.use('/api/security/pin', securityRoutes);

describe('Security PIN & Anti-Brute-Force Protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserHolder.user = {
      _id: 'user_test_1',
      email: 'user@test.vn',
      transactionPinHash: null,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      biometricEnabled: false,
      pinResetOtpHash: null,
      pinResetOtpExpiresAt: null,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };

    jest.spyOn(User, 'findById').mockImplementation(() => Promise.resolve(mockUserHolder.user));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('User Schema Verification', () => {
    it('User model should have default security PIN fields', () => {
      const user = new User({ email: 'pin@test.vn', passwordHash: 'hash' });
      expect(user.transactionPinHash).toBeNull();
      expect(user.failedPinAttempts).toBe(0);
      expect(user.pinLockedUntil).toBeNull();
      expect(user.biometricEnabled).toBe(false);
      expect(user.qrCodePayload).toBeNull();
      expect(user.pinResetOtpHash).toBeNull();
      expect(user.pinResetOtpExpiresAt).toBeNull();
    });
  });

  describe('GET /api/security/pin/status', () => {
    it('should return status when user has no PIN and is not locked', async () => {
      const res = await request(app).get('/api/security/pin/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        hasPin: false,
        isLocked: false,
        lockRemainingSeconds: 0,
        biometricEnabled: false,
      });
    });

    it('should return status when user has PIN and is locked', async () => {
      mockUserHolder.user.transactionPinHash = await bcrypt.hash('123456', 10);
      mockUserHolder.user.pinLockedUntil = new Date(Date.now() + 600 * 1000); // 10 minutes left
      mockUserHolder.user.biometricEnabled = true;

      const res = await request(app).get('/api/security/pin/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.hasPin).toBe(true);
      expect(res.body.data.isLocked).toBe(true);
      expect(res.body.data.lockRemainingSeconds).toBeGreaterThan(500);
      expect(res.body.data.biometricEnabled).toBe(true);
    });
  });

  describe('POST /api/security/pin/setup', () => {
    it('should reject PIN not matching 6 digits', async () => {
      const res = await request(app)
        .post('/api/security/pin/setup')
        .send({ pin: '12345', confirmPin: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject PIN with non-numeric characters', async () => {
      const res = await request(app)
        .post('/api/security/pin/setup')
        .send({ pin: '12345a', confirmPin: '12345a' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject when confirmPin does not match pin', async () => {
      const res = await request(app)
        .post('/api/security/pin/setup')
        .send({ pin: '123456', confirmPin: '654321' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should successfully setup 6-digit PIN and store bcrypt hash', async () => {
      const res = await request(app)
        .post('/api/security/pin/setup')
        .send({ pin: '123456', confirmPin: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUserHolder.user.transactionPinHash).toBeDefined();
      expect(mockUserHolder.user.transactionPinHash).not.toBe('123456');
      const isMatch = await bcrypt.compare('123456', mockUserHolder.user.transactionPinHash);
      expect(isMatch).toBe(true);
      expect(mockUserHolder.user.save).toHaveBeenCalled();
    });

    it('should reject setup if user already has PIN configured', async () => {
      mockUserHolder.user.transactionPinHash = await bcrypt.hash('123456', 10);
      const res = await request(app)
        .post('/api/security/pin/setup')
        .send({ pin: '654321', confirmPin: '654321' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/security/pin/verify', () => {
    beforeEach(async () => {
      mockUserHolder.user.transactionPinHash = await bcrypt.hash('123456', 10);
      mockUserHolder.user.failedPinAttempts = 0;
      mockUserHolder.user.pinLockedUntil = null;
    });

    it('should verify correct PIN successfully and reset failedPinAttempts', async () => {
      mockUserHolder.user.failedPinAttempts = 2;
      const res = await request(app)
        .post('/api/security/pin/verify')
        .send({ pin: '123456' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUserHolder.user.failedPinAttempts).toBe(0);
      expect(mockUserHolder.user.pinLockedUntil).toBeNull();
    });

    it('should increment failed attempts and return attemptsLeft on wrong PIN (1-4 times)', async () => {
      const res = await request(app)
        .post('/api/security/pin/verify')
        .send({ pin: '000000' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PIN_INVALID');
      expect(res.body.attemptsLeft).toBe(4);
      expect(mockUserHolder.user.failedPinAttempts).toBe(1);
    });

    it('should lock account for 15 minutes on 5th consecutive wrong attempt', async () => {
      mockUserHolder.user.failedPinAttempts = 4;
      const res = await request(app)
        .post('/api/security/pin/verify')
        .send({ pin: '000000' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PIN_LOCKED');
      expect(res.body.attemptsLeft).toBe(0);
      expect(res.body.lockRemainingSeconds).toBeGreaterThan(800);
      expect(mockUserHolder.user.pinLockedUntil).toBeInstanceOf(Date);
      expect(mockUserHolder.user.failedPinAttempts).toBe(5);
    });

    it('should reject verification with 403 when PIN is currently locked', async () => {
      mockUserHolder.user.pinLockedUntil = new Date(Date.now() + 600 * 1000);
      mockUserHolder.user.failedPinAttempts = 5;

      const res = await request(app)
        .post('/api/security/pin/verify')
        .send({ pin: '123456' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('PIN_LOCKED');
      expect(res.body.lockRemainingSeconds).toBeGreaterThan(0);
    });

    it('should reject verification if user has not set up PIN', async () => {
      mockUserHolder.user.transactionPinHash = null;
      const res = await request(app)
        .post('/api/security/pin/verify')
        .send({ pin: '123456' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/security/pin/change', () => {
    beforeEach(async () => {
      mockUserHolder.user.transactionPinHash = await bcrypt.hash('123456', 10);
    });

    it('should reject if old PIN is incorrect', async () => {
      const res = await request(app)
        .post('/api/security/pin/change')
        .send({ oldPin: '999999', newPin: '654321', confirmPin: '654321' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject if new PIN does not match confirmation', async () => {
      const res = await request(app)
        .post('/api/security/pin/change')
        .send({ oldPin: '123456', newPin: '654321', confirmPin: '654322' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should change PIN successfully when old PIN matches', async () => {
      const res = await request(app)
        .post('/api/security/pin/change')
        .send({ oldPin: '123456', newPin: '654321', confirmPin: '654321' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const isNewMatch = await bcrypt.compare('654321', mockUserHolder.user.transactionPinHash);
      expect(isNewMatch).toBe(true);
    });
  });

  describe('Forgot & Reset PIN via Email OTP', () => {
    it('POST /api/security/pin/forgot should generate OTP, hash it, and send email', async () => {
      const res = await request(app).post('/api/security/pin/forgot');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mailService.sendOtpEmail).toHaveBeenCalledWith(
        'user@test.vn',
        expect.stringMatching(/^\d{6}$/),
        expect.any(Object)
      );
      expect(mockUserHolder.user.pinResetOtpHash).toBeDefined();
      expect(mockUserHolder.user.pinResetOtpExpiresAt).toBeInstanceOf(Date);
    });

    it('POST /api/security/pin/reset-with-otp should reject expired OTP', async () => {
      mockUserHolder.user.pinResetOtpHash = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'financeflow')
        .update('654321')
        .digest('hex');
      mockUserHolder.user.pinResetOtpExpiresAt = new Date(Date.now() - 1000); // expired

      const res = await request(app)
        .post('/api/security/pin/reset-with-otp')
        .send({ otp: '654321', newPin: '999888', confirmPin: '999888' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/hết hạn|không hợp lệ/i);
    });

    it('POST /api/security/pin/reset-with-otp should reject incorrect OTP', async () => {
      mockUserHolder.user.pinResetOtpHash = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'financeflow')
        .update('654321')
        .digest('hex');
      mockUserHolder.user.pinResetOtpExpiresAt = new Date(Date.now() + 600 * 1000);

      const res = await request(app)
        .post('/api/security/pin/reset-with-otp')
        .send({ otp: '000000', newPin: '999888', confirmPin: '999888' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/không chính xác/i);
    });

    it('POST /api/security/pin/reset-with-otp should reset PIN and unlock account on valid OTP', async () => {
      const otp = '888999';
      mockUserHolder.user.pinResetOtpHash = crypto
        .createHmac('sha256', process.env.JWT_SECRET || 'financeflow')
        .update(otp)
        .digest('hex');
      mockUserHolder.user.pinResetOtpExpiresAt = new Date(Date.now() + 600 * 1000);
      mockUserHolder.user.failedPinAttempts = 5;
      mockUserHolder.user.pinLockedUntil = new Date(Date.now() + 900 * 1000);

      const res = await request(app)
        .post('/api/security/pin/reset-with-otp')
        .send({ otp, newPin: '112233', confirmPin: '112233' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockUserHolder.user.failedPinAttempts).toBe(0);
      expect(mockUserHolder.user.pinLockedUntil).toBeNull();
      expect(mockUserHolder.user.pinResetOtpHash).toBeNull();
      expect(mockUserHolder.user.pinResetOtpExpiresAt).toBeNull();

      const isMatch = await bcrypt.compare('112233', mockUserHolder.user.transactionPinHash);
      expect(isMatch).toBe(true);
    });
  });

  describe('Biometric Toggle', () => {
    it('POST /api/security/pin/biometric/toggle should toggle biometric setting', async () => {
      mockUserHolder.user.biometricEnabled = false;
      const res = await request(app)
        .post('/api/security/pin/biometric/toggle')
        .send({ enabled: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.biometricEnabled).toBe(true);
      expect(mockUserHolder.user.biometricEnabled).toBe(true);
    });
  });
});
