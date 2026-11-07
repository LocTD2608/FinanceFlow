jest.mock('../src/services/chat/gemini', () => ({ assertConfigured: jest.fn(), generate: jest.fn() }));
jest.mock('../src/services/chat/tools', () => ({ executeTool: jest.fn(), declarations: [{ name: 'financial_summary' }, { name: 'list_choices' }, { name: 'draft_transaction' }] }));
jest.mock('../src/services/chat/state', () => ({ acquireConversation: jest.fn(), releaseConversation: jest.fn(), saveTurn: jest.fn(), currentAction: jest.fn(), publicAction: jest.fn(a => a), consumeQuota: jest.fn() }));
const gemini = require('../src/services/chat/gemini');
const tools = require('../src/services/chat/tools');
const state = require('../src/services/chat/state');
const { sendMessage } = require('../src/services/chat/service');
const answer = { role: 'model', parts: [{ text: 'Kết quả' }] };
beforeEach(() => {
  jest.resetAllMocks();
  state.publicAction.mockImplementation(a => a);
  state.acquireConversation.mockResolvedValue({ conversation: { _id: 'c', messages: [] }, token: 'lease' });
  state.currentAction.mockResolvedValue(null);
  state.saveTurn.mockResolvedValue({ reply: 'Kết quả' });
  tools.executeTool.mockResolvedValue({ facts: { expense: 10 } });
});
afterEach(() => jest.useRealTimers());
test('answers every parallel tool call, including ID, in Gemini user role', async () => {
  gemini.generate.mockResolvedValueOnce({ role: 'model', parts: [
    { functionCall: { name: 'financial_summary', args: {}, id: 'one' }, thoughtSignature: 'signature' },
    { functionCall: { name: 'list_choices', args: {}, id: 'two' } },
  ] }).mockResolvedValueOnce(answer);
  await sendMessage('u', { message: 'x' });
  expect(tools.executeTool).toHaveBeenCalledTimes(2);
  const toolResponse = gemini.generate.mock.calls[1][0][2];
  expect(toolResponse.role).toBe('user');
  expect(toolResponse.parts.map(p => p.functionResponse.id)).toEqual(['one', 'two']);
});
test('uses 20 context messages, current action state and quota only at route', async () => {
  state.acquireConversation.mockResolvedValue({ conversation: { _id: 'c', messages: Array.from({ length: 40 }, (_, i) => ({ role: i % 2 ? 'model' : 'user', text: String(i) })) }, token: 'lease' });
  state.currentAction.mockResolvedValue({ status: 'cancelled', id: 'draft' });
  gemini.generate.mockResolvedValue(answer);
  await sendMessage('u', { message: 'x' });
  expect(gemini.generate.mock.calls[0][0]).toHaveLength(21);
  expect(gemini.generate.mock.calls[0][2]).toContain('cancelled');
  expect(state.consumeQuota).not.toHaveBeenCalled();
});
test('invalid draft fields let AI ask a follow-up instead of terminating the turn', async () => {
  const { ChatError } = require('../src/services/chat/errors');
  tools.executeTool.mockRejectedValueOnce(new ChatError(400, 'INVALID_INPUT', 'Hãy chọn ví'));
  gemini.generate.mockResolvedValueOnce({ role: 'model', parts: [{ functionCall: { name: 'draft_transaction', args: {} } }] })
    .mockResolvedValueOnce({ role: 'model', parts: [{ text: 'Bạn muốn dùng ví nào?' }] });
  await sendMessage('u', { message: 'ghi ăn trưa' });
  expect(state.saveTurn).toHaveBeenCalledWith('u', expect.anything(), 'ghi ăn trưa', 'Bạn muốn dùng ví nào?', [], undefined);
});
test('deadline rejects even a provider mock that ignores abort', async () => {
  jest.useFakeTimers();
  gemini.generate.mockImplementation(() => new Promise(() => {}));
  const pending = sendMessage('u', { message: 'x' });
  const assertion = expect(pending).rejects.toMatchObject({ status: 504 });
  await jest.advanceTimersByTimeAsync(30001);
  await assertion;
  expect(state.saveTurn).not.toHaveBeenCalled();
  expect(state.releaseConversation).toHaveBeenCalled();
});
