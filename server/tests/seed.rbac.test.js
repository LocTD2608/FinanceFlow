const { getDemoData } = require('../src/seeds/demo.seed');

describe('Seed Data RBAC', () => {
  it('demo seed should return admin and demo user with correct roles', async () => {
    const data = await getDemoData({});
    expect(data.admin).toBeDefined();
    expect(data.admin.email).toBe('admin@financeflow.vn');
    expect(data.admin.role).toBe('admin');
    expect(data.admin.status).toBe('active');
    expect(data.user.role).toBe('user');
    expect(data.user.status).toBe('active');
  });
});
