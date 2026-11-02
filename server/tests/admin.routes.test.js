const request = require('supertest');
const express = require('express');

// Mock auth middleware to let x-mock-role populate req.user
jest.mock('../src/middleware/auth', () => (req, res, next) => {
  const role = req.headers['x-mock-role'] || 'user';
  const id = req.headers['x-mock-id'] || 'admin_1';
  req.user = { id, email: `${id}@test.com`, role, status: 'active' };
  next();
});

const adminRoutes = require('../src/routes/admin.routes');
const User = require('../src/models/User');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');

jest.mock('../src/models/User');
jest.mock('../src/models/Category');
jest.mock('../src/models/Transaction');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

describe('Admin Routes & Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Route Protection', () => {
    it('GET /api/admin/metrics should reject normal user with 403', async () => {
      const res = await request(app).get('/api/admin/metrics').set('x-mock-role', 'user');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/admin/metrics should allow admin with 200 and return metrics', async () => {
      User.countDocuments = jest.fn()
        .mockResolvedValueOnce(50) // totalUsers
        .mockResolvedValueOnce(45) // activeUsers
        .mockResolvedValueOnce(5)  // lockedUsers
        .mockResolvedValueOnce(2);  // adminUsers
      Transaction.countDocuments = jest.fn().mockResolvedValue(120);
      Category.countDocuments = jest.fn().mockResolvedValue(8);

      const res = await request(app).get('/api/admin/metrics').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toEqual(
        expect.objectContaining({
          totalUsers: 50,
          activeUsers: 45,
          lockedUsers: 5,
          adminUsers: 2,
          totalTransactions: 120,
          totalDefaultCategories: 8,
        })
      );
    });
  });

  describe('User Management', () => {
    it('GET /api/admin/users should return users list', async () => {
      const mockUsers = [
        { _id: 'u1', username: 'User1', email: 'u1@test.com', role: 'user', status: 'active' },
        { _id: 'u2', username: 'User2', email: 'u2@test.com', role: 'admin', status: 'active' },
      ];
      User.find = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue(mockUsers),
              }),
            }),
          }),
        }),
      });
      User.countDocuments = jest.fn().mockResolvedValue(2);

      const res = await request(app).get('/api/admin/users').set('x-mock-role', 'admin');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users.length).toBe(2);
    });

    it('PATCH /api/admin/users/:id/status should forbid self-lock with 400', async () => {
      const res = await request(app)
        .patch('/api/admin/users/admin_1/status')
        .set('x-mock-role', 'admin')
        .set('x-mock-id', 'admin_1')
        .send({ status: 'locked' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/chính mình/);
    });

    it('PATCH /api/admin/users/:id/status should allow locking other user', async () => {
      User.findByIdAndUpdate = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: 'u_target', email: 't@test.com', status: 'locked' }),
      });

      const res = await request(app)
        .patch('/api/admin/users/u_target/status')
        .set('x-mock-role', 'admin')
        .set('x-mock-id', 'admin_1')
        .send({ status: 'locked' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.status).toBe('locked');
    });

    it('PATCH /api/admin/users/:id/role should forbid self-demotion with 400', async () => {
      const res = await request(app)
        .patch('/api/admin/users/admin_1/role')
        .set('x-mock-role', 'admin')
        .set('x-mock-id', 'admin_1')
        .send({ role: 'user' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/chính mình/);
    });

    it('PATCH /api/admin/users/:id/role should prevent demoting the last active admin', async () => {
      User.countDocuments = jest.fn().mockResolvedValue(1); // Only 1 admin in system
      const res = await request(app)
        .patch('/api/admin/users/admin_2/role')
        .set('x-mock-role', 'admin')
        .set('x-mock-id', 'admin_1')
        .send({ role: 'user' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/ít nhất 1 Quản trị viên/);
    });

    it('PATCH /api/admin/users/:id/role should promote user to admin', async () => {
      User.countDocuments = jest.fn().mockResolvedValue(2);
      User.findByIdAndUpdate = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({ _id: 'u_target', email: 't@test.com', role: 'admin' }),
      });

      const res = await request(app)
        .patch('/api/admin/users/u_target/role')
        .set('x-mock-role', 'admin')
        .set('x-mock-id', 'admin_1')
        .send({ role: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe('admin');
    });
  });

  describe('Category Management', () => {
    it('POST /api/admin/categories should create default system category', async () => {
      Category.create = jest.fn().mockResolvedValue({
        _id: 'cat_sys_1',
        name: 'Chi tiêu công cộng',
        type: 'expense',
        icon: 'landmark',
        color: '#4F46E5',
        isDefault: true,
        userId: null,
      });

      const res = await request(app)
        .post('/api/admin/categories')
        .set('x-mock-role', 'admin')
        .send({
          name: 'Chi tiêu công cộng',
          type: 'expense',
          icon: 'landmark',
          color: '#4F46E5',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.category.isDefault).toBe(true);
      expect(res.body.category.userId).toBeNull();
    });
  });
});
