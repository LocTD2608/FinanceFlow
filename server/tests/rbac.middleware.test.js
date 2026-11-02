const jwt = require('jsonwebtoken');
const auth = require('../src/middleware/auth');
const { requireRole } = require('../src/middleware/rbac');
const User = require('../src/models/User');

jest.mock('../src/models/User');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('RBAC Middleware', () => {
  it('requireRole should call next when role matches', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('requireRole should return 403 when role does not match', () => {
    const req = { user: { role: 'user' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('auth middleware should reject locked user with 403', async () => {
    const SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';
    const token = jwt.sign({ id: 'u_locked', email: 'locked@b.c', role: 'user' }, SECRET);
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'u_locked', email: 'locked@b.c', role: 'user', status: 'locked' })
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: expect.stringMatching(/khóa/),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('auth middleware should populate req.user with role and status for active user', async () => {
    const SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';
    const token = jwt.sign({ id: 'u_active', email: 'active@b.c', role: 'admin' }, SECRET);
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'u_active', email: 'active@b.c', role: 'admin', status: 'active' })
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 'u_active',
      email: 'active@b.c',
      role: 'admin',
      status: 'active',
    });
  });
});
