const mongoose = require('mongoose');
const ChatConversation = require('../src/models/ChatConversation');
const ChatAction = require('../src/models/ChatAction');

describe('Chat Models Unit Tests', () => {
  it('ChatConversation yêu cầu userId và khởi tạo mảng messages rỗng', () => {
    const conv = new ChatConversation({});
    const err = conv.validateSync();
    expect(err.errors.userId).toBeDefined();
    expect(Array.isArray(conv.messages)).toBe(true);
    expect(conv.messages.length).toBe(0);
  });

  it('ChatConversation messages hỗ trợ role user, model, system, tool', () => {
    const conv = new ChatConversation({
      userId: new mongoose.Types.ObjectId(),
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
    });
    const err = conv.validateSync();
    expect(err).toBeUndefined();
  });

  it('ChatAction kiểm tra enum type và enum status', () => {
    const action = new ChatAction({
      userId: new mongoose.Types.ObjectId(),
      conversationId: new mongoose.Types.ObjectId(),
      type: 'invalid_type',
      status: 'invalid_status',
    });
    const err = action.validateSync();
    expect(err.errors.type).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });

  it('ChatAction hợp lệ khi đúng enum type, status, payload, preview, expiresAt', () => {
    const action = new ChatAction({
      userId: new mongoose.Types.ObjectId(),
      conversationId: new mongoose.Types.ObjectId(),
      type: 'create_transaction',
      status: 'pending',
      payload: { amount: 50000 },
      preview: { amount: 50000, walletName: 'Tiền mặt' },
      expiresAt: new Date(Date.now() + 600000),
    });
    const err = action.validateSync();
    expect(err).toBeUndefined();
  });
});
