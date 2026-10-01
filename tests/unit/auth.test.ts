import { authApi } from '../../src/api/auth';

describe('Auth Flow Unit Tests', () => {
  it('should register a new user successfully with offline fallback', async () => {
    const res = await authApi.register('Nam Hoang', '0912345678', 'nam@test.vn', 'Pass1234');
    expect(res.success).toBe(true);
    expect(res.user?.username).toBe('Nam Hoang');
    expect(res.token).toBeDefined();
  });

  it('should prevent registering duplicate email', async () => {
    const res = await authApi.register('Nam Duplicate', '0988888888', 'nam@test.vn', 'Pass1234');
    expect(res.success).toBe(false);
    expect(res.message).toContain('đã tồn tại');
  });

  it('should login successfully with correct credentials', async () => {
    const res = await authApi.login('nam@test.vn', 'Pass1234');
    expect(res.success).toBe(true);
    expect(res.user?.username).toBe('Nam Hoang');
  });

  it('should fail login with wrong password', async () => {
    const res = await authApi.login('nam@test.vn', 'WrongPassword');
    expect(res.success).toBe(false);
  });
});
