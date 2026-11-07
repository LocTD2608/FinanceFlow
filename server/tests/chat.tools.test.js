jest.mock('../src/models/Wallet');
jest.mock('../src/models/Category');
jest.mock('../src/models/Transaction');
jest.mock('../src/models/Budget');
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const { executeTool } = require('../src/services/chat/tools');
const uid = '507f1f77bcf86cd799439011';
const wid = '507f1f77bcf86cd799439012';
const cid = '507f1f77bcf86cd799439013';
const query = value => ({ select: jest.fn().mockReturnThis(), session: jest.fn().mockReturnThis(),
  lean: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), maxTimeMS: jest.fn().mockResolvedValue(value) });
beforeEach(() => {
  jest.clearAllMocks();
  Wallet.findOne.mockReturnValue(query({ _id: wid, name: 'Tiền mặt', type: 'cash', currency: 'VND' }));
  Category.findOne.mockReturnValue(query({ _id: cid, name: 'Ăn uống', type: 'expense' }));
});
test.each(['confirm', 'eval', '__proto__', 'constructor'])('rejects unknown tool %s', async name => {
  await expect(executeTool(uid, name, {})).rejects.toMatchObject({ status: 400 });
});
test('rejects injected owner, mongo operators, nonfinite amounts and impossible dates', async () => {
  for (const extra of [{ userId: uid }, { amount: Infinity }, { amount: '50000' }, { amount: 0 },
    { walletId: { $ne: null } }, { date: '2026-02-31' }]) {
    await expect(executeTool(uid, 'draft_transaction', {
      type: 'expense', amount: 50000, walletId: wid, categoryId: cid, ...extra,
    })).rejects.toMatchObject({ status: 400 });
  }
});
test('draft is a preview only, validated with owner filters', async () => {
  const result = await executeTool(uid, 'draft_transaction', {
    type: 'expense', amount: 50000, walletId: wid, categoryId: cid, date: '2026-11-07',
  });
  expect(result.draft.payload.transactionDate).toBe('2026-11-06T17:00:00.000Z');
  expect(result.draft.preview.walletName).toBe('Tiền mặt');
  expect(Wallet.findOne).toHaveBeenCalledWith(expect.objectContaining({ userId: uid, isArchived: false }));
  expect(Transaction.create).not.toHaveBeenCalled();
  expect(Budget.create).not.toHaveBeenCalled();
});
test('does not guess a missing wallet and rejects foreign categories', async () => {
  await expect(executeTool(uid, 'draft_transaction', { type: 'expense', amount: 50, categoryId: cid }))
    .rejects.toMatchObject({ status: 400 });
  Category.findOne.mockReturnValue(query(null));
  await expect(executeTool(uid, 'draft_budget', { categoryId: cid, limitAmount: 50, month: '2026-11' }))
    .rejects.toMatchObject({ status: 400 });
});
test('summary excludes transfers and binds UTC+7 period and owner', async () => {
  Transaction.aggregate.mockReturnValue({ option: jest.fn().mockResolvedValue([]) });
  Wallet.find.mockReturnValue(query([])); Budget.find.mockReturnValue(query([]));
  const result = await executeTool(uid, 'financial_summary', { period: 'month', date: '2026-11-01' });
  expect(result.facts.income).toBe(0);
  const match = Transaction.aggregate.mock.calls[0][0][0].$match;
  expect(String(match.userId)).toBe(uid);
  expect(match.type).toEqual({ $in: ['income', 'expense'] });
  expect(match.transactionDate.$gte.toISOString()).toBe('2026-10-31T17:00:00.000Z');
});
