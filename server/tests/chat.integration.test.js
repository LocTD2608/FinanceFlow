const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
jest.mock('../src/services/realtime.service', () => ({ emitBalanceChange: jest.fn() }));
const realtime = require('../src/services/realtime.service');
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const ChatConversation = require('../src/models/ChatConversation');
const ChatAction = require('../src/models/ChatAction');
const ChatQuota = require('../src/models/ChatQuota');
const { confirm, cancel } = require('../src/services/chat/actions');
const { acquireConversation, saveTurn, releaseConversation, consumeQuota, getConversation } = require('../src/services/chat/state');
const { validateDraft } = require('../src/services/chat/tools');
jest.setTimeout(180000);
let mongo, uid, wallet, category;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'kan34_test' });
  await Promise.all([Wallet, Category, Transaction, Budget, ChatConversation, ChatAction, ChatQuota].map(m => m.init()));
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await Promise.all([Wallet, Category, Transaction, Budget, ChatConversation, ChatAction, ChatQuota].map(m => m.deleteMany({})));
  jest.clearAllMocks();
  uid = new mongoose.Types.ObjectId().toString();
  wallet = await Wallet.create({ userId: uid, name: 'Tiền mặt', balance: 100000, accountNumber: 'test-wallet' });
  category = await Category.create({ name: 'Ăn uống', type: 'expense' });
});
async function draft(kind = 'create_transaction', conversationId) {
  const lease = await acquireConversation(uid, conversationId);
  const input = kind === 'create_transaction' ? { type: 'expense', amount: 50000, walletId: String(wallet._id), categoryId: String(category._id) }
    : { categoryId: String(category._id), limitAmount: 100000, month: '2026-11' };
  const proposed = await validateDraft(uid, kind, input);
  const result = await saveTurn(uid, lease, 'ghi chi', 'Hãy xác nhận', [], proposed);
  await releaseConversation(uid, lease);
  return result;
}
test('draft writes no money; simultaneous and repeated confirmation execute once', async () => {
  const result = await draft();
  expect(await Transaction.countDocuments()).toBe(0);
  const id = String(result.pendingAction.id);
  const results = await Promise.all([confirm(uid, id), confirm(uid, id), confirm(uid, id)]);
  expect(new Set(results.map(r => String(r.resultId))).size).toBe(1);
  expect(await Transaction.countDocuments()).toBe(1);
  expect((await Wallet.findById(wallet._id)).balance).toBe(50000);
  expect(realtime.emitBalanceChange).toHaveBeenCalledTimes(1);
  expect((await getConversation(uid, result.conversationId)).pendingAction.status).toBe('confirmed');
});
test('foreign owner, cancelled, expired and replaced drafts cannot write', async () => {
  const first = await draft();
  await expect(confirm(new mongoose.Types.ObjectId().toString(), first.pendingAction.id)).rejects.toMatchObject({ status: 404 });
  const second = await draft('create_transaction', first.conversationId);
  await expect(confirm(uid, first.pendingAction.id)).rejects.toMatchObject({ status: 409 });
  await cancel(uid, second.pendingAction.id);
  await cancel(uid, second.pendingAction.id);
  await expect(confirm(uid, second.pendingAction.id)).rejects.toMatchObject({ status: 409 });
  const third = await draft();
  await ChatAction.updateOne({ _id: third.pendingAction.id }, { $set: { expiresAt: new Date(0) } });
  await expect(confirm(uid, third.pendingAction.id)).rejects.toMatchObject({ status: 410 });
  expect(await Transaction.countDocuments()).toBe(0);
});
test('failed record creation rolls back wallet and leaves draft pending', async () => {
  const result = await draft();
  const spy = jest.spyOn(Transaction, 'create').mockRejectedValueOnce(new Error('injected failure'));
  await expect(confirm(uid, result.pendingAction.id)).rejects.toThrow('injected failure');
  spy.mockRestore();
  expect((await Wallet.findById(wallet._id)).balance).toBe(100000);
  expect((await ChatAction.findById(result.pendingAction.id)).status).toBe('pending');
  expect(realtime.emitBalanceChange).not.toHaveBeenCalled();
  await confirm(uid, result.pendingAction.id);
  expect(await Transaction.countDocuments()).toBe(1);
});
test('confirmation rechecks funds and category ownership', async () => {
  const result = await draft();
  await Wallet.updateOne({ _id: wallet._id }, { balance: 100 });
  await expect(confirm(uid, result.pendingAction.id)).rejects.toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
  await Category.updateOne({ _id: category._id }, { userId: new mongoose.Types.ObjectId() });
  await expect(confirm(uid, result.pendingAction.id)).rejects.toMatchObject({ status: 400 });
  expect(await Transaction.countDocuments()).toBe(0);
});
test('budget confirmation is idempotent and duplicate month never overwrites', async () => {
  const a = await draft('create_budget');
  await confirm(uid, a.pendingAction.id); await confirm(uid, a.pendingAction.id);
  const b = await draft('create_budget');
  await expect(confirm(uid, b.pendingAction.id)).rejects.toMatchObject({ status: 409 });
  expect(await Budget.countDocuments()).toBe(1);
});
test('leases and shared quota reject concurrent excess requests', async () => {
  const lease = await acquireConversation(uid);
  await expect(acquireConversation(uid, String(lease.conversation._id))).rejects.toMatchObject({ status: 409 });
  await releaseConversation(uid, lease);
  const results = await Promise.allSettled(Array.from({ length: 15 }, () => consumeQuota(uid, 'message', 10)));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(10);
});
test('a late save cannot publish a draft and orphan action is removed', async () => {
  const lease = await acquireConversation(uid);
  lease.deadlineAt = Date.now() - 1;
  const proposed = await validateDraft(uid, 'create_budget', { categoryId: String(category._id), limitAmount: 50 });
  await expect(saveTurn(uid, lease, 'x', 'preview', [], proposed)).rejects.toMatchObject({ status: 409 });
  expect(await ChatAction.countDocuments()).toBe(0);
  expect((await ChatConversation.findById(lease.conversation._id)).messages).toHaveLength(0);
});
test('confirm racing cancellation has exactly one outcome', async () => {
  const result = await draft();
  await Promise.allSettled([confirm(uid, result.pendingAction.id), cancel(uid, result.pendingAction.id)]);
  const action = await ChatAction.findById(result.pendingAction.id);
  const count = await Transaction.countDocuments();
  expect(count).toBe(action.status === 'confirmed' ? 1 : 0);
  expect((await Wallet.findById(wallet._id)).balance).toBe(count ? 50000 : 100000);
});
