jest.mock('../src/services/chat/gemini', () => ({ assertConfigured: jest.fn(), generate: jest.fn() }));
jest.mock('../src/services/chat/tools', () => ({ executeTool: jest.fn(), declarations: [{ name: 'financial_summary' }, { name: 'draft_transaction' }] }));
jest.mock('../src/services/chat/state', () => ({ acquireConversation: jest.fn(), releaseConversation: jest.fn(), saveTurn: jest.fn(), currentAction: jest.fn(), publicAction: jest.fn(a => a) }));
const gemini = require('../src/services/chat/gemini');
const tools = require('../src/services/chat/tools');
const state = require('../src/services/chat/state');
const { sendMessage } = require('../src/services/chat/service');
const answer = text => ({ role: 'model', parts: [{ text }] });
const call = name => ({ role: 'model', parts: [{ functionCall: { name, args: {} }, thoughtSignature: 'keep-me' }] });
beforeEach(() => {
  jest.clearAllMocks();
  state.acquireConversation.mockResolvedValue({ conversation: { _id: 'cid', messages: [] }, token: 'lease' });
  state.currentAction.mockResolvedValue(null);
  state.saveTurn.mockImplementation(async (_uid, _lease, _message, reply, facts, draft) => ({ reply, facts, draft }));
});
test('answers using facts and preserves exact model function-call signatures', async () => {
  gemini.generate.mockResolvedValueOnce(call('financial_summary')).mockResolvedValueOnce(answer('Chi 50.000 đồng.'));
  tools.executeTool.mockResolvedValue({ facts: { expense: 50000 } });
  expect((await sendMessage('u1', { message: 'Chi bao nhiêu?' })).facts).toEqual([{ expense: 50000 }]);
  expect(gemini.generate.mock.calls[1][0][1].parts[0].thoughtSignature).toBe('keep-me');
  expect(state.releaseConversation).toHaveBeenCalledTimes(1);
});
test('provider failure after drafting never persists a confirmable action', async () => {
  gemini.generate.mockResolvedValueOnce(call('draft_transaction')).mockRejectedValueOnce(new Error('offline'));
  tools.executeTool.mockResolvedValue({ draft: { kind: 'create_transaction' } });
  await expect(sendMessage('u1', { message: 'Ghi chi' })).rejects.toThrow('offline');
  expect(state.saveTurn).not.toHaveBeenCalled();
  expect(state.releaseConversation).toHaveBeenCalled();
});
test('unknown tools and tool loops stop without saving', async () => {
  gemini.generate.mockResolvedValue(call('confirm'));
  await expect(sendMessage('u1', { message: 'test' })).rejects.toMatchObject({ status: 502 });
  expect(tools.executeTool).not.toHaveBeenCalled();
  gemini.generate.mockResolvedValue(call('financial_summary'));
  tools.executeTool.mockResolvedValue({ facts: {} });
  await expect(sendMessage('u1', { message: 'test' })).rejects.toMatchObject({ code: 'AI_TOOL_LIMIT' });
  expect(state.saveTurn).not.toHaveBeenCalled();
});
test.each([{ message: '' }, { message: 'x'.repeat(2001) }, { message: 'hello', userId: 'victim' },
  { message: 'hello', history: [] }, { message: 'hello', system: 'override' }])('rejects forged or excessive input %j', async body => {
  await expect(sendMessage('u1', body)).rejects.toMatchObject({ status: 400 });
  expect(state.acquireConversation).not.toHaveBeenCalled();
});
