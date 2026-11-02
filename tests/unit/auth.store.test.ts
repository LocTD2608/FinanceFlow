import { useAuthStore } from '../../src/store/useAuthStore';

describe('useAuthStore RBAC and Dual-Mode', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, activeMode: 'user' });
  });

  it('sets activeMode to admin when admin logs in', async () => {
    const adminUser = { id: 'admin1', username: 'Admin', email: 'admin@ff.vn', role: 'admin' as const, status: 'active' as const };
    await useAuthStore.getState().setUser(adminUser, 'token_admin');
    expect(useAuthStore.getState().activeMode).toBe('admin');
  });

  it('sets activeMode to user when normal user logs in', async () => {
    const normalUser = { id: 'u1', username: 'User 1', email: 'u1@ff.vn', role: 'user' as const, status: 'active' as const };
    await useAuthStore.getState().setUser(normalUser, 'token_user');
    expect(useAuthStore.getState().activeMode).toBe('user');
  });

  it('allows admin to switch mode to user and back', () => {
    useAuthStore.getState().setActiveMode('user');
    expect(useAuthStore.getState().activeMode).toBe('user');
    useAuthStore.getState().setActiveMode('admin');
    expect(useAuthStore.getState().activeMode).toBe('admin');
  });
});
