const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('KAN-34 Upgrades: AG-UI Level 1, Bill OCR, Goal Summary & User-only RBAC', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.dontMock('../src/socket');
    jest.dontMock('../src/models/User');
    jest.dontMock('../src/services/chat/service');
    jest.dontMock('../src/services/chat/actions');
    jest.dontMock('../src/services/chat/state');
    jest.dontMock('../src/services/chat/gemini');
    jest.dontMock('../src/services/chat/tools');
    jest.dontMock('../src/services/realtime.service');
  });

  test('realtime.service.emitAguiEvent phát sự kiện agui:event tới room user', () => {
    jest.isolateModules(() => {
      const ioMock = { to: jest.fn().mockReturnThis(), emit: jest.fn() };
      jest.doMock('../src/socket', () => ({ getIO: () => ioMock }));
      const realtime = require('../src/services/realtime.service');

      expect(typeof realtime.emitAguiEvent).toBe('function');
      realtime.emitAguiEvent('u_123', {
        type: 'RUN_STARTED',
        runId: 'run_1',
        threadId: 'conv_1',
      });

      expect(ioMock.to).toHaveBeenCalledWith('user_u_123');
      expect(ioMock.emit).toHaveBeenCalledWith(
        'agui:event',
        expect.objectContaining({
          type: 'RUN_STARTED',
          runId: 'run_1',
          threadId: 'conv_1',
          timestamp: expect.any(String),
        })
      );
    });
  });

  test('chat.routes từ chối tài khoản admin (strict user-only scope)', async () => {
    let routes;
    jest.isolateModules(() => {
      jest.doMock('../src/models/User', () => ({
        findById: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({ status: 'active', role: 'admin' }),
        }),
      }));
      jest.doMock('../src/services/chat/service', () => ({ sendMessage: jest.fn() }));
      jest.doMock('../src/services/chat/actions', () => ({ confirm: jest.fn(), cancel: jest.fn() }));
      jest.doMock('../src/services/chat/state', () => ({
        getConversation: jest.fn(),
        consumeQuota: jest.fn(),
      }));
      routes = require('../src/routes/chat.routes');
    });

    const app = express();
    app.use(express.json());
    app.use('/api/chat', routes);

    const token = jwt.sign(
      { id: '507f1f77bcf86cd799439011' },
      process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026'
    );

    const res = await request(app)
      .post('/api/chat/messages')
      .auth(token, { type: 'bearer' })
      .send({ message: 'hi' });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  test('service.sendMessage hỗ trợ Bill OCR inlineData và phát chuỗi sự kiện AG-UI Level 1', async () => {
    const emitAguiEvent = jest.fn();
    const generate = jest
      .fn()
      .mockResolvedValueOnce({
        role: 'model',
        parts: [{ functionCall: { name: 'draft_transaction', args: { amount: 65000 } } }],
      })
      .mockResolvedValueOnce({
        role: 'model',
        parts: [{ text: 'Tôi đã đọc hóa đơn 65.000 đ, hãy xác nhận để lưu.' }],
      });

    let sendMessage;
    jest.isolateModules(() => {
      jest.doMock('../src/services/realtime.service', () => ({ emitAguiEvent }));
      jest.doMock('../src/services/chat/gemini', () => ({
        assertConfigured: jest.fn(),
        generate,
      }));
      jest.doMock('../src/services/chat/tools', () => ({
        declarations: [{ name: 'draft_transaction' }],
        executeTool: jest.fn().mockResolvedValue({
          draft: { kind: 'create_transaction', preview: { amount: 65000 }, payload: {} },
        }),
      }));
      jest.doMock('../src/services/chat/state', () => ({
        acquireConversation: jest.fn().mockResolvedValue({
          conversation: { _id: 'conv_ocr', messages: [] },
          token: 'lease_1',
        }),
        releaseConversation: jest.fn(),
        saveTurn: jest.fn().mockImplementation(async (_uid, _lease, _msg, reply, facts, draft) => ({
          conversationId: 'conv_ocr',
          reply,
          facts,
          pendingAction: { id: 'act_1', kind: draft.kind, preview: draft.preview, status: 'pending' },
        })),
        currentAction: jest.fn().mockResolvedValue(null),
        publicAction: jest.fn((a) => a),
      }));

      ({ sendMessage } = require('../src/services/chat/service'));
    });

    const out = await sendMessage('u_ocr', {
      message: '',
      imageBase64: Buffer.from('fake-jpeg-bytes').toString('base64'),
      imageMimeType: 'image/jpeg',
    });

    expect(out.reply).toContain('65.000');
    const firstTurnParts = generate.mock.calls[0][0][0].parts;
    expect(firstTurnParts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inlineData: expect.objectContaining({ mimeType: 'image/jpeg' }),
        }),
      ])
    );

    const eventTypes = emitAguiEvent.mock.calls.map((c) => c[1].type);
    expect(eventTypes).toEqual(
      expect.arrayContaining([
        'RUN_STARTED',
        'STEP_STARTED',
        'TOOL_CALL_START',
        'TOOL_CALL_RESULT',
        'TEXT_MESSAGE_CONTENT',
        'STATE_DELTA',
        'RUN_FINISHED',
      ])
    );

    await expect(
      sendMessage('u_ocr', {
        message: 'scan',
        imageBase64: 'YWJj',
        imageMimeType: 'application/pdf',
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  test('tools.executeTool hỗ trợ goal_summary chỉ đọc mục tiêu của chính user', async () => {
    let Goal;
    let executeTool;
    jest.isolateModules(() => {
      Goal = require('../src/models/Goal');
      ({ executeTool } = require('../src/services/chat/tools'));
    });

    const queryChain = {
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maxTimeMS: jest.fn().mockResolvedValue([
        {
          name: 'Mua Laptop',
          targetAmount: 20000000,
          currentAmount: 5000000,
          status: 'active',
          overdueStage: 'none',
          deadline: null,
        },
      ]),
    };
    jest.spyOn(Goal, 'find').mockReturnValue(queryChain);

    const result = await executeTool('507f1f77bcf86cd799439011', 'goal_summary', {});

    expect(Goal.find).toHaveBeenCalledWith({ userId: '507f1f77bcf86cd799439011' });
    expect(result.facts.goals).toHaveLength(1);
    expect(result.facts.goals[0]).toMatchObject({
      name: 'Mua Laptop',
      progressPercent: 25,
    });
  });
});
