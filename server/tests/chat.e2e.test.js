const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/services/chat/gemini', () => ({ assertConfigured: jest.fn(), generate: jest.fn() }));
jest.mock('../src/services/realtime.service', () => ({ emitBalanceChange: jest.fn() }));
const gemini = require('../src/services/chat/gemini');
const User = require('../src/models/User');
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const Conversation = require('../src/models/ChatConversation');
const Action = require('../src/models/ChatAction');
const Quota = require('../src/models/ChatQuota');
const router = require('../src/routes/chat.routes');
const app = express(); app.use(express.json()); app.use('/api/chat', router);
const models = [User, Wallet, Category, Transaction, Budget, Conversation, Action, Quota];
let mongo, token, otherToken, wallet, expense, income;
jest.setTimeout(180000);
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.14' } });
  await mongoose.connect(mongo.getUri(), { dbName: 'kan34_http_test' });
  await Promise.all(models.map(m => m.init()));
});
afterAll(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
beforeEach(async () => {
  await Promise.all(models.map(m => m.deleteMany({})));
  jest.resetAllMocks();
  const user = await User.create({ email: 'chat@example.test', passwordHash: 'test-only' });
  const other = await User.create({ email: 'other@example.test', passwordHash: 'test-only' });
  const secret = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';
  token = jwt.sign({ id: String(user._id) }, secret);
  otherToken = jwt.sign({ id: String(other._id) }, secret);
  wallet = await Wallet.create({ userId: user._id, name: 'Ví thử nghiệm', balance: 100000 });
  [expense, income] = await Category.create([{ name: 'Ăn uống', type: 'expense' }, { name: 'Lương', type: 'income' }]);
});
const post = (path, data, auth = token) => request(app).post(`/api/chat${path}`).auth(auth, { type: 'bearer' }).send(data);
function tool(name, args, text = 'Kết quả theo dữ liệu hệ thống.') {
  gemini.generate.mockResolvedValueOnce({ role: 'model', parts: [{ functionCall: { name, args } }] })
    .mockResolvedValueOnce({ role: 'model', parts: [{ text }] });
}
test('HTTP flow covers guide, expense/income drafts, budget, facts/advice and idempotent confirmation', async () => {
  tool('app_guide', {});
  const guide = await post('/messages', { message: 'Hướng dẫn sử dụng chatbot' });
  expect(guide.status).toBe(200); expect(guide.body.data.facts[0].guide).toContain('FinanceFlow');
  const conversationId = guide.body.data.conversationId;
  for (const [type, amount, category] of [['expense', 50000, expense], ['income', 20000, income]]) {
    tool('draft_transaction', { type, amount, walletId: String(wallet._id), categoryId: String(category._id) });
    const draft = await post('/messages', { message: `Ghi ${type} ${amount}`, conversationId });
    expect(draft.status).toBe(200);
    const id = draft.body.data.pendingAction.id;
    expect(draft.body.data.pendingAction.status).toBe('pending');
    const before = await Transaction.countDocuments();
    expect((await post(`/actions/${id}/confirm`, {}, otherToken)).status).toBe(404);
    const a = await post(`/actions/${id}/confirm`, {});
    const b = await post(`/actions/${id}/confirm`, {});
    expect(a.status).toBe(200); expect(b.body.data.resultId).toBe(a.body.data.resultId);
    expect(await Transaction.countDocuments()).toBe(before + 1);
  }
  expect((await Wallet.findById(wallet._id)).balance).toBe(70000);
  tool('draft_budget', { categoryId: String(expense._id), limitAmount: 100000 });
  const draft = await post('/messages', { message: 'Tạo ngân sách ăn uống 100 nghìn', conversationId });
  expect(await Budget.countDocuments()).toBe(0);
  expect((await post(`/actions/${draft.body.data.pendingAction.id}/confirm`, {})).status).toBe(200);
  expect(await Budget.countDocuments()).toBe(1);
  tool('financial_summary', { period: 'month' }, 'Bạn đã chi 50.000 đồng; hãy theo dõi ngân sách ăn uống.');
  const advice = await post('/messages', { message: 'Thống kê tháng này và gợi ý chi tiêu', conversationId });
  expect(advice.status).toBe(200);
  expect(advice.body.data.facts[0]).toMatchObject({ expense: 50000, income: 20000 });
  expect(advice.body.data.reply).toContain('ngân sách');
  const history = await request(app).get(`/api/chat/conversations/${conversationId}`).auth(token, { type: 'bearer' });
  expect(history.body.data.messages).toHaveLength(10);
  expect((await request(app).get(`/api/chat/conversations/${conversationId}`).auth(otherToken, { type: 'bearer' })).status).toBe(404);
});
test('real route and service allow exactly ten turns per minute, not five', async () => {
  const fixedNow = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
  try {
  gemini.generate.mockResolvedValue({ role: 'model', parts: [{ text: 'Xin chào' }] });
  for (let i = 0; i < 10; i++) expect((await post('/messages', { message: 'Xin chào' })).status).toBe(200);
  const blocked = await post('/messages', { message: 'Xin chào' });
  expect(blocked.status).toBe(429); expect(blocked.headers['retry-after']).toBe('60');
  expect(gemini.generate).toHaveBeenCalledTimes(10);
  } finally { clock.mockRestore(); }
});
