const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const authController = require('../src/controllers/auth.controller');
const bcrypt = require('bcryptjs');

const SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('User Model & Auth Controller Role/Status', () => {
  it('User model should have role and status defaults', () => {
    const user = new User({ email: 'test@role.vn', passwordHash: 'hash' });
    expect(user.role).toBe('user');
    expect(user.status).toBe('active');
  });

  it('User model should reject invalid role or status', () => {
    const user = new User({ email: 'invalid@role.vn', passwordHash: 'hash', role: 'superman', status: 'banned' });
    const err = user.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.role).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });

  it('User model should accept valid role and status', () => {
    const user = new User({ email: 'admin@role.vn', passwordHash: 'hash', role: 'admin', status: 'locked' });
    const err = user.validateSync();
    expect(err).toBeUndefined();
    expect(user.role).toBe('admin');
    expect(user.status).toBe('locked');
  });

  it('authController.login should reject locked accounts with 403', async () => {
    const userFindOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue({
      _id: 'u_locked_1',
      email: 'locked@ff.vn',
      status: 'locked',
      role: 'user',
      passwordHash: await bcrypt.hash('123456', 10),
    });

    const req = { body: { identifier: 'locked@ff.vn', password: 'password' } };
    const res = mockRes();

    await authController.login(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/khóa/),
      })
    );

    userFindOneSpy.mockRestore();
  });

  it('authController.login should return user role, status and signed token with role', async () => {
    const pwdHash = await bcrypt.hash('secret123', 10);
    const userFindOneSpy = jest.spyOn(User, 'findOne').mockResolvedValue({
      _id: 'u_admin_1',
      email: 'admin@ff.vn',
      username: 'Admin',
      phone: '0988888888',
      role: 'admin',
      status: 'active',
      authProvider: 'local',
      passwordHash: pwdHash,
    });

    const req = { body: { identifier: 'admin@ff.vn', password: 'secret123' } };
    const res = mockRes();

    await authController.login(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        user: expect.objectContaining({
          role: 'admin',
          status: 'active',
        }),
        token: expect.any(String),
      })
    );

    const token = res.json.mock.calls[0][0].token;
    const decoded = jwt.verify(token, SECRET);
    expect(decoded.role).toBe('admin');

    userFindOneSpy.mockRestore();
  });
});
