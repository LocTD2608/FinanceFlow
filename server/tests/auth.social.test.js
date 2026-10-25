const request = require('supertest');
const express = require('express');

// Mock User and Wallet models
jest.mock('../src/models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');

describe('POST /api/auth/social-login', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Load fresh app/router
    app = express();
    app.use(express.json());
    const authRoutes = require('../src/routes/auth.routes');
    app.use('/api/auth', authRoutes);
  });

  it('từ chối khi provider không hợp lệ', async () => {
    const res = await request(app)
      .post('/api/auth/social-login')
      .send({
        provider: 'twitter',
        email: 'test@twitter.com',
        oauthId: 'tw_123',
        username: 'Twitter User',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/nhà cung cấp không hợp lệ/i);
  });

  it('từ chối khi thiếu email hoặc oauthId', async () => {
    const res = await request(app)
      .post('/api/auth/social-login')
      .send({
        provider: 'google',
        username: 'Google User',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('tạo user mới và tự động tạo ví mặc định khi đăng nhập lần đầu', async () => {
    User.findOne.mockResolvedValue(null);
    const mockCreatedUser = {
      _id: 'user_123',
      email: 'new.google@gmail.com',
      username: 'New Google User',
      authProvider: 'google',
      oauthId: 'g_123',
      avatar: 'https://avatar.png',
    };
    User.create.mockResolvedValue(mockCreatedUser);
    Wallet.findOne.mockResolvedValue(null);
    Wallet.create.mockResolvedValue({ _id: 'wallet_1', name: 'Ví tiền mặt' });

    const res = await request(app)
      .post('/api/auth/social-login')
      .send({
        provider: 'google',
        email: 'new.google@gmail.com',
        oauthId: 'g_123',
        username: 'New Google User',
        avatar: 'https://avatar.png',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('new.google@gmail.com');
    expect(Wallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_123',
        name: 'Ví tiền mặt',
        isDefault: true,
      })
    );
  });

  it('đăng nhập thành công và không tạo trùng ví đối với user đã tồn tại', async () => {
    const existingUser = {
      _id: 'user_existing',
      email: 'existing.apple@privaterelay.appleid.com',
      username: 'Existing Apple User',
      authProvider: 'apple',
      oauthId: 'apple_sub_123',
      save: jest.fn().mockResolvedValue(true),
    };
    User.findOne.mockResolvedValue(existingUser);
    Wallet.findOne.mockResolvedValue({ _id: 'wallet_existing', name: 'Ví tiền mặt' });

    const res = await request(app)
      .post('/api/auth/social-login')
      .send({
        provider: 'apple',
        email: 'existing.apple@privaterelay.appleid.com',
        oauthId: 'apple_sub_123',
        username: 'Existing Apple User',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('existing.apple@privaterelay.appleid.com');
    expect(Wallet.create).not.toHaveBeenCalled();
  });
});
