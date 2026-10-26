const User = require('../src/models/User');

describe('User Model Schema - Social Auth Support', () => {
  it('cho phép tạo user từ mạng xã hội không có passwordHash', () => {
    const socialUser = new User({
      email: 'test.social@gmail.com',
      username: 'Social User',
      authProvider: 'google',
      oauthId: 'google_12345',
      avatar: 'https://example.com/avatar.png',
    });
    const err = socialUser.validateSync();
    expect(err).toBeUndefined();
  });

  it('bắt buộc passwordHash nếu authProvider là local', () => {
    const localUser = new User({
      email: 'local.user@gmail.com',
      username: 'Local User',
      authProvider: 'local',
    });
    const err = localUser.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.passwordHash).toBeDefined();
  });

  it('từ chối authProvider không nằm trong enum', () => {
    const invalidUser = new User({
      email: 'invalid@gmail.com',
      username: 'Invalid User',
      authProvider: 'twitter',
    });
    const err = invalidUser.validateSync();
    expect(err).toBeDefined();
    expect(err.errors.authProvider).toBeDefined();
  });
});
