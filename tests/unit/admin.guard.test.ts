describe('Role Guard Navigation Logic', () => {
  const resolveScreen = (user: any, activeMode: string) => {
    if (!user) return 'welcome';
    if (user.role === 'admin' && activeMode === 'admin') return 'admin_portal';
    return 'home';
  };

  it('routes admin in admin mode to admin_portal', () => {
    expect(resolveScreen({ role: 'admin' }, 'admin')).toBe('admin_portal');
  });

  it('routes admin in user mode to home', () => {
    expect(resolveScreen({ role: 'admin' }, 'user')).toBe('home');
  });

  it('routes normal user to home regardless of mode', () => {
    expect(resolveScreen({ role: 'user' }, 'admin')).toBe('home');
    expect(resolveScreen({ role: 'user' }, 'user')).toBe('home');
  });

  it('routes unauthenticated user to welcome', () => {
    expect(resolveScreen(null, 'user')).toBe('welcome');
  });
});
