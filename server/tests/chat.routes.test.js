const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../src/services/chat/service', () => ({ sendMessage: jest.fn() }));
jest.mock('../src/services/chat/actions', () => ({ confirm: jest.fn(), cancel: jest.fn() }));
jest.mock('../src/services/chat/state', () => ({ getConversation: jest.fn(), consumeQuota: jest.fn() }));
const User = require('../src/models/User');
const service = require('../src/services/chat/service');
const actions = require('../src/services/chat/actions');
const routes = require('../src/routes/chat.routes');
const uid = '507f1f77bcf86cd799439011';
const token = jwt.sign({ id: uid }, process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026');
const app = express(); app.use(express.json()); app.use('/api/chat', routes);
beforeEach(() => {
  jest.clearAllMocks();
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ status: 'active', role: 'user' }) });
  service.sendMessage.mockResolvedValue({ reply: 'Xin chào' });
});
test('requires login and fails closed for deleted users', async () => {
  expect((await request(app).post('/api/chat/messages').send({ message: 'hi' })).status).toBe(401);
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
  expect((await request(app).post('/api/chat/messages').auth(token, { type: 'bearer' }).send({ message: 'hi' })).status).toBe(401);
  expect(service.sendMessage).not.toHaveBeenCalled();
});
test('locked users are denied and database failure does not fall back to JWT', async () => {
  User.findById.mockReturnValue({ select: jest.fn().mockResolvedValue({ status: 'locked' }) });
  expect((await request(app).post('/api/chat/messages').auth(token, { type: 'bearer' }).send({ message: 'hi' })).status).toBe(403);
  User.findById.mockReturnValue({ select: jest.fn().mockRejectedValue(new Error('secret db connection')) });
  const result = await request(app).post('/api/chat/messages').auth(token, { type: 'bearer' }).send({ message: 'hi' });
  expect(result.status).toBe(503); expect(JSON.stringify(result.body)).not.toContain('secret');
});
test('forwards authenticated owner and refuses replacement confirmation payload', async () => {
  const result = await request(app).post('/api/chat/messages').auth(token, { type: 'bearer' }).send({ message: 'hi' });
  expect(result.body).toMatchObject({ success: true, data: { reply: 'Xin chào' } });
  expect(service.sendMessage).toHaveBeenCalledWith(uid, { message: 'hi' });
  expect((await request(app).post('/api/chat/actions/507f1f77bcf86cd799439012/confirm')
    .auth(token, { type: 'bearer' }).send({ amount: 1 })).status).toBe(400);
  expect(actions.confirm).not.toHaveBeenCalled();
});
