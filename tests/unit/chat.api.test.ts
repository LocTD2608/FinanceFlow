jest.mock('../../src/api/config', () => ({ API_BASE_URL: 'http://localhost:5000/api' }));
import { chatApi } from '../../src/api/chat';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });
test('sends authenticated messages without client-owned history', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: { reply: 'Xin chào' } }) });
  const result = await chatApi.sendMessage('token', { message: 'hi' });
  expect(result.reply).toBe('Xin chào');
  expect(global.fetch).toHaveBeenCalledWith('http://localhost:5000/api/chat/messages', expect.objectContaining({
    method: 'POST', headers: expect.objectContaining({ Authorization: 'Bearer token' }), body: '{"message":"hi"}',
  }));
});
test('confirmation only sends action ID; server errors are surfaced without retry', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 410,
    json: async () => ({ success: false, code: 'ACTION_EXPIRED', message: 'Hết hạn' }) });
  await expect(chatApi.confirm('token', 'action-id')).rejects.toMatchObject({ code: 'ACTION_EXPIRED', status: 410 });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect((global.fetch as jest.Mock).mock.calls[0][1].body).toBe('{}');
});
test('cleans up timeout on network failure and rejects missing auth before sending', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  await expect(chatApi.sendMessage('token', { message: 'hi' })).rejects.toThrow('offline');
  expect(jest.getTimerCount()).toBe(0);
  await expect(chatApi.confirm('', 'id')).rejects.toThrow('đăng nhập');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});
