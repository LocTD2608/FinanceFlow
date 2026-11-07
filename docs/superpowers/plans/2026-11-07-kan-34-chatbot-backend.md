# Kế hoạch Triển khai Chi tiết: Backend Chatbot FinanceFlow với Gemini (KAN-34)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Xây dựng hệ thống API backend cho chatbot thông minh FinanceFlow tích hợp Gemini Function Calling: hỗ trợ hỏi đáp bằng tiếng Việt, truy vấn số liệu tài chính cá nhân (thu/chi/số dư/ngân sách theo múi giờ UTC+7), tạo bản nháp hành động (thêm giao dịch, tạo ngân sách) với cơ chế xác nhận/hủy nguyên tử qua MongoDB Transaction, kèm TypeScript API client cho ứng dụng frontend.

**Architecture:** Kiến trúc Client-Server phân tầng trên Node.js/Express và MongoDB/Mongoose. Tầng Chatbot bao gồm Gemini AI Service (xử lý gọi hàm Function Calling an toàn, có rate limit và mock provider), Chat Tools Service (kiểm soát chặt chẽ quyền đọc và tạo nháp ghi dữ liệu theo userId từ JWT), Action Execution Manager (thực thi ghi dữ liệu nguyên tử trong MongoDB Transaction thông qua `runInTransaction` và hoàn tác an toàn), cùng TypeScript Client bọc contract API chuẩn hoá cho client Expo.

**Tech Stack:** Node.js, Express (CommonJS), MongoDB, Mongoose 8.x, Google Gen AI SDK / REST Function Calling, Socket.io, TypeScript, Jest, Supertest.

**Spec:** [`docs/superpowers/specs/2026-11-07-kan-34-chatbot-backend-design.md`](file:///C:/Users/truon/orca/workspaces/FinanceFlow/feat-financial-center/docs/superpowers/specs/2026-11-07-kan-34-chatbot-backend-design.md)

---

## Global Constraints

- Backend Express/CommonJS, MongoDB/Mongoose; ứng dụng Expo/TypeScript gọi API bằng JWT.
- Toàn bộ thời gian báo cáo và lọc kỳ ngày/tháng sử dụng múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7) thông qua `server/src/utils/period.js`.
- Đơn vị tiền tệ mặc định: VND.
- AI không bao giờ được phép trực tiếp ghi vào database; mọi thao tác ghi (`create_transaction`, `create_budget`) bắt buộc phải thông qua trạng thái `ChatAction` bản nháp (`pending`) với thời hạn 10 phút.
- Xác nhận ghi (`POST /api/chat/actions/:id/confirm`) bắt buộc chạy trong MongoDB Transaction (`runInTransaction`), kiểm tra số dư tại thời điểm commit, cập nhật số dư ví và tạo giao dịch nguyên tử. Nếu database là MongoDB standalone không hỗ trợ transaction, trả về HTTP status 503 với mã lỗi `TRANSACTION_UNSUPPORTED`, không hạ xuống ghi không nguyên tử.
- Thao tác xác nhận hành động phải đảm bảo tính Idempotent (gọi lại action đã `confirmed` trả kết quả đã lưu mà không ghi đúp).
- Socket realtime `balance:change` chỉ được phát sau khi MongoDB Transaction commit thành công; không phát lại khi retry action đã `confirmed`.
- Giới hạn tải & an toàn: Tối đa 2.000 ký tự/tin nhắn; tối đa 4 vòng lặp công cụ và 8 lượt gọi công cụ mỗi request; timeout 30s; rate limit 10 lượt AI/phút/user; lưu tối đa 40 tin gần nhất và gửi tối đa 20 tin gần nhất cho AI mà không làm đứt cặp `function_call` / `function_response`.
- Tuyệt đối không log thông tin nhạy cảm (JWT, mật khẩu, PIN, nội dung tài chính nhạy cảm) ra console log.
- Commit chuẩn convention: `feat(chatbot): KAN-34 Tich hop logic backend cho chatbot` (hoặc các commit nhỏ theo task).

---

## Review Focus

1. **Thất bại giữa chừng khi cập nhật số dư và lưu giao dịch:** Khi một thao tác trong transaction bị lỗi (hoặc ví thông thường không đủ số dư), toàn bộ thay đổi số dư và bản ghi transaction phải bị rollback hoàn toàn, số dư ví giữ nguyên, action không được chuyển sang `confirmed`.
2. **Cạnh tranh đồng thời (Race condition) khi bấm nút Xác nhận đúp:** Hai request xác nhận cùng một `actionId` gửi đồng thời chỉ có 1 request thực thi ghi dữ liệu, request còn lại trả về kết quả đã xác nhận mà không sinh ra 2 giao dịch hoặc trừ tiền 2 lần.
3. **Bảo mật và cô lập dữ liệu người dùng (User Data Isolation):** Người dùng A không thể truy vấn số dư, ví, ngân sách hay xem/xác nhận/hủy `ChatAction` và `ChatConversation` của người dùng B, trả về 404/403 rõ ràng.
4. **Xung đột trùng lặp Ngân sách:** Khi tạo ngân sách qua chatbot cho một danh mục trong tháng đã có ngân sách tồn tại, hệ thống phải phát hiện xung đột và trả về lỗi rõ ràng (HTTP 409), không ghi đè ngân sách cũ.
5. **AI trả về tham số không hợp lệ hoặc model timeout/lỗi upstream:** Khi Gemini trả về tên tool lạ, tham số âm/sai định dạng, hoặc quá timeout 30s, backend phải xử lý graceful trả về HTTP 400 hoặc 504 với message thông báo an toàn cho người dùng thay vì crash tiến trình server.

---

### Task 1: Định nghĩa Schemas Mongoose `ChatConversation` và `ChatAction`

**Files:**
- Create: `server/src/models/ChatConversation.js`
- Create: `server/src/models/ChatAction.js`
- Test: `server/tests/chat.models.test.js`

**Interfaces:**
- Produces: Mongoose models `ChatConversation` và `ChatAction` với đầy đủ indexes, TTL 30 ngày, validation các trường bắt buộc.

- [x] **Step 1: Viết test kiểm tra schema validation và indexes cho `ChatConversation` và `ChatAction`**

```javascript
// server/tests/chat.models.test.js
const mongoose = require('mongoose');
const ChatConversation = require('../src/models/ChatConversation');
const ChatAction = require('../src/models/ChatAction');

describe('Chat Models Unit Tests', () => {
  it('ChatConversation yêu cầu userId và khởi tạo mảng messages rỗng', () => {
    const conv = new ChatConversation({});
    const err = conv.validateSync();
    expect(err.errors.userId).toBeDefined();
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
});
```

- [x] **Step 2: Chạy test để xác nhận test thất bại**

Run: `npm --prefix server test tests/chat.models.test.js`
Expected: FAIL (Cannot find module '../src/models/ChatConversation')

- [x] **Step 3: Triển khai `ChatConversation.js` và `ChatAction.js`**

Tạo `server/src/models/ChatConversation.js`:
- `userId`: `ObjectId`, ref `User`, `required: true`, `index: true`.
- `title`: `String`, `default: 'Hội thoại tài chính'`.
- `messages`: Mảng subdocuments gồm `{ role: { type: String, enum: ['user', 'assistant', 'system'] }, content: String, facts: Object, actionId: ObjectId, createdAt: { type: Date, default: Date.now } }`.
- `activeActionId`: `ObjectId`, ref `ChatAction`, `default: null`.
- `lockExpiresAt`: `Date`, `default: null`.
- `timestamps: true`, TTL index: `{ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }`.

Tạo `server/src/models/ChatAction.js`:
- `userId`: `ObjectId`, ref `User`, `required: true`, `index: true`.
- `conversationId`: `ObjectId`, ref `ChatConversation`, `required: true`, `index: true`.
- `type`: `String`, `enum: ['create_transaction', 'create_budget']`, `required: true`.
- `payload`: `Object`, `required: true`.
- `preview`: `Object`, `required: true`.
- `status`: `String`, `enum: ['pending', 'confirmed', 'cancelled', 'expired']`, `default: 'pending'`, `index: true`.
- `expiresAt`: `Date`, `required: true`.
- `resultId`: `ObjectId`, `default: null`.
- `resultSummary`: `Object`, `default: null`.
- `timestamps: true`, TTL index: `{ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 }`.

- [x] **Step 4: Chạy lại test để xác nhận test pass**

Run: `npm --prefix server test tests/chat.models.test.js`
Expected: PASS

- [x] **Step 5: Commit thay đổi Task 1**

```bash
git add server/src/models/ChatConversation.js server/src/models/ChatAction.js server/tests/chat.models.test.js
git commit -m "feat(chatbot): dinh nghia mongoose models ChatConversation va ChatAction"
```

---

### Task 2: Nâng cấp `walletBalance.js` Hỗ trợ MongoDB Session trong Transaction

**Files:**
- Modify: `server/src/utils/walletBalance.js`
- Test: `server/tests/walletBalance.session.test.js`

**Interfaces:**
- Consumes: Mongoose `ClientSession` từ `runInTransaction`.
- Produces: `applyDelta(walletId, delta, options)` và `applyDeltas(deltas, options)` nhận `{ session }` tùy chọn, giữ nguyên 100% tương thích ngược với code hiện tại.

- [x] **Step 1: Viết test cho `applyDelta` và `applyDeltas` khi có session**

```javascript
// server/tests/walletBalance.session.test.js
const { applyDelta, applyDeltas } = require('../src/utils/walletBalance');
const Wallet = require('../src/models/Wallet');

jest.mock('../src/models/Wallet');

describe('walletBalance with session', () => {
  afterEach(() => jest.clearAllMocks());

  it('truyền session vào findByIdAndUpdate khi delta >= 0', async () => {
    const mockSession = { id: 'mock-session-id' };
    Wallet.findByIdAndUpdate.mockResolvedValue({ _id: 'w1', balance: 1000 });

    await applyDelta('w1', 500, { session: mockSession });
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      'w1',
      { $inc: { balance: 500 } },
      { new: true, session: mockSession }
    );
  });

  it('truyền session vào findOneAndUpdate khi trừ tiền ví thường', async () => {
    const mockSession = { id: 'mock-session-id' };
    Wallet.findOneAndUpdate.mockResolvedValue({ _id: 'w1', balance: 500 });

    await applyDelta('w1', -500, { session: mockSession });
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'w1', $or: [{ type: 'credit_card' }, { balance: { $gte: 500 } }] },
      { $inc: { balance: -500 } },
      { new: true, session: mockSession }
    );
  });
});
```

- [x] **Step 2: Chạy test để kiểm tra thất bại**

Run: `npm --prefix server test tests/walletBalance.session.test.js`
Expected: FAIL (options.session not passed to findByIdAndUpdate)

- [x] **Step 3: Cập nhật `server/src/utils/walletBalance.js`**

Bổ sung tham số `options = {}` vào `applyDelta` và `applyDeltas`:
```javascript
const applyDelta = async (walletId, delta, options = {}) => {
  const updateOptions = { new: true, ...options };
  if (delta >= 0) {
    return Wallet.findByIdAndUpdate(walletId, { $inc: { balance: delta } }, updateOptions);
  }
  return Wallet.findOneAndUpdate(
    { _id: walletId, $or: [{ type: 'credit_card' }, { balance: { $gte: -delta } }] },
    { $inc: { balance: delta } },
    updateOptions
  );
};

const applyDeltas = async (deltas, options = {}) => {
  const ordered = [...deltas].sort((a, b) => b.delta - a.delta);
  const applied = [];
  for (const d of ordered) {
    const result = await applyDelta(d.walletId, d.delta, options);
    if (!result) {
      for (const done of applied.reverse()) {
        await Wallet.findByIdAndUpdate(
          done.walletId,
          { $inc: { balance: -done.delta } },
          { new: true, ...options }
        );
      }
      return { ok: false, walletId: d.walletId, delta: d.delta };
    }
    applied.push(d);
  }
  return { ok: true };
};
```

- [x] **Step 4: Chạy test unit và test hồi quy cho ví**

Run: `npm --prefix server test tests/walletBalance.session.test.js tests/budget.wallet.test.js tests/transaction.controller.test.js`
Expected: ALL PASS

- [x] **Step 5: Commit thay đổi Task 2**

```bash
git add server/src/utils/walletBalance.js server/tests/walletBalance.session.test.js
git commit -m "feat(chatbot): cap nhat walletBalance ho tro truyen session trong transaction"
```

---

### Task 3: Triển khai Service Đọc Dữ liệu Tài chính & Tạo Bản nháp (`chatTools.service.js`)

**Files:**
- Create: `server/src/services/chatTools.service.js`
- Test: `server/tests/chat.tools.test.js`

**Interfaces:**
- Consumes: Models `Wallet`, `Category`, `Transaction`, `Budget`, `ChatAction`, helpers `period.js`, `categoryRules.js`.
- Produces: 
  - `getAppGuide(query)`: Trả về tài liệu hướng dẫn tính năng thực tế.
  - `getWalletsAndCategories(userId)`: Lấy danh sách ví hoạt động và danh mục hợp lệ.
  - `getFinancialSummary(userId, { period, date })`: Thống kê thu, chi, số dư theo giờ UTC+7.
  - `getBudgets(userId, { month })`: Thống kê ngân sách và mức chi tiêu tháng.
  - `proposeTransaction(userId, conversationId, { amount, type, walletId, categoryId, note, date })`: Tạo bản nháp `ChatAction`.
  - `proposeBudget(userId, conversationId, { categoryId, limitAmount, month })`: Tạo bản nháp `ChatAction`.

- [x] **Step 1: Viết test cho các tool nghiệp vụ tài chính của Chatbot**

```javascript
// server/tests/chat.tools.test.js
const chatTools = require('../src/services/chatTools.service');
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const Transaction = require('../src/models/Transaction');
const ChatAction = require('../src/models/ChatAction');

jest.mock('../src/models/Wallet');
jest.mock('../src/models/Category');
jest.mock('../src/models/Transaction');
jest.mock('../src/models/ChatAction');

describe('ChatTools Service Unit Tests', () => {
  const userId = '507f1f77bcf86cd799439011';
  const convId = '507f1f77bcf86cd799439022';

  it('getFinancialSummary tính đúng tổng thu, tổng chi và bỏ qua giao dịch transfer/p2p', async () => {
    Transaction.aggregate.mockResolvedValue([
      { _id: 'income', total: 5000000 },
      { _id: 'expense', total: 2000000 },
    ]);
    const summary = await chatTools.getFinancialSummary(userId, { period: 'month' });
    expect(summary.totalIncome).toBe(5000000);
    expect(summary.totalExpense).toBe(2000000);
    expect(summary.net).toBe(3000000);
  });

  it('proposeTransaction từ chối khi số tiền <= 0', async () => {
    await expect(
      chatTools.proposeTransaction(userId, convId, { amount: -100 })
    ).rejects.toThrow('Số tiền giao dịch phải là số dương.');
  });
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm --prefix server test tests/chat.tools.test.js`
Expected: FAIL (Cannot find module '../src/services/chatTools.service')

- [x] **Step 3: Triển khai `server/src/services/chatTools.service.js`**

Cung cấp đầy đủ:
- Tích hợp `period.getPeriodRange(period, date)` tính đúng `from` và `to` UTC+7.
- Kiểm tra danh mục "Khác" bắt buộc ghi chú qua `categoryRules.validateNoteForCategory`.
- Kiểm tra ví thuộc `userId` và không bị xóa `isDeleted: false`.
- Hủy các `ChatAction` trạng thái `pending` cũ của conversation trước khi tạo action mới:
  `await ChatAction.updateMany({ conversationId, status: 'pending' }, { status: 'cancelled' })`.
- Tạo `ChatAction` mới với `expiresAt = new Date(Date.now() + 10 * 60 * 1000)` (10 phút).
- Chuẩn hóa trường `preview` rõ ràng (Tên ví, tên danh mục, số tiền format `100.000 đ`, ngày giao dịch...).

- [x] **Step 4: Chạy lại test suite để kiểm tra tính đúng đắn**

Run: `npm --prefix server test tests/chat.tools.test.js`
Expected: PASS

- [x] **Step 5: Commit thay đổi Task 3**

```bash
git add server/src/services/chatTools.service.js server/tests/chat.tools.test.js
git commit -m "feat(chatbot): implement chatTools service truy van du lieu va tao ban nhap"
```

---

### Task 4: Xây dựng Gemini AI Service với Function Calling & Mock Provider

**Files:**
- Create: `server/src/services/gemini.service.js`
- Test: `server/tests/gemini.service.test.js`

**Interfaces:**
- Consumes: `process.env.GEMINI_API_KEY`, `process.env.GEMINI_MODEL`, `chatTools.service.js`.
- Produces: `executeChatTurn({ userId, conversationId, messageHistory, userMessage })` -> `{ reply, facts, pendingAction }`.

- [x] **Step 1: Viết test cho `gemini.service.js` (kiểm tra mock provider, tool loop, rate limiter, message limit)**

```javascript
// server/tests/gemini.service.test.js
const geminiService = require('../src/services/gemini.service');

describe('Gemini Service Unit Tests', () => {
  it('từ chối tin nhắn vượt quá 2000 ký tự', async () => {
    const longMsg = 'a'.repeat(2001);
    await expect(
      geminiService.executeChatTurn({
        userId: 'u1',
        conversationId: 'c1',
        messageHistory: [],
        userMessage: longMsg,
      })
    ).rejects.toThrow('Tin nhắn không được vượt quá 2000 ký tự.');
  });

  it('hoạt động trơn tru với mock provider khi không có GEMINI_API_KEY', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await geminiService.executeChatTurn({
      userId: 'u1',
      conversationId: 'c1',
      messageHistory: [],
      userMessage: 'Xin chào FinanceFlow',
      mockResponse: { text: 'Chào bạn, tôi là trợ lý FinanceFlow!' },
    });
    expect(res.reply).toContain('FinanceFlow');
  });
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm --prefix server test tests/gemini.service.test.js`
Expected: FAIL (Cannot find module '../src/services/gemini.service')

- [x] **Step 3: Triển khai `server/src/services/gemini.service.js`**

- Định nghĩa Tool Declarations tương thích OpenAPI / Gemini function calling:
  - `get_financial_summary`: `{ period: { type: 'string', enum: ['day','week','month','year'] }, date: { type: 'string' } }`
  - `get_wallets_and_categories`: `{}`
  - `get_budgets`: `{ month: { type: 'string', description: 'YYYY-MM' } }`
  - `get_app_guide`: `{ query: { type: 'string' } }`
  - `propose_create_transaction`: `{ amount, type, walletId, categoryId, note, date }`
  - `propose_create_budget`: `{ categoryId, limitAmount, month }`
- Sử dụng Google REST endpoint `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}` qua native `fetch` (Node 24).
- Cắt gọt lịch sử: Chỉ lấy tối đa 20 tin nhắn gần nhất; kiểm tra tính toàn vẹn của cặp `function_call` và `function_response`.
- Kiểm soát vòng lặp: Tối đa 4 vòng gọi tool, tối đa 8 tool calls tổng. Timeout 30 giây bằng `AbortController`.
- Rate limit 10 lượt AI/phút/user bằng atomic tracking.

- [x] **Step 4: Chạy test để xác nhận pass**

Run: `npm --prefix server test tests/gemini.service.test.js`
Expected: PASS

- [x] **Step 5: Commit thay đổi Task 4**

```bash
git add server/src/services/gemini.service.js server/tests/gemini.service.test.js
git commit -m "feat(chatbot): xay dung gemini service voi function calling va tool execution loop"
```

---

### Task 5: Triển khai Chat Controller & Xác nhận Ghi Nguyên tử qua Transaction

**Files:**
- Create: `server/src/controllers/chat.controller.js`
- Create: `server/src/routes/chat.routes.js`
- Test: `server/tests/chat.controller.test.js`

**Interfaces:**
- Consumes: `authMiddleware`, `runInTransaction`, `walletBalance`, `realtime.service`, `ChatConversation`, `ChatAction`.
- Produces: Các endpoints `/api/chat`:
  - `POST /messages`: Gửi tin nhắn, sinh câu trả lời & draft action.
  - `GET /conversations/:id`: Lấy lịch sử hội thoại của user.
  - `POST /actions/:id/confirm`: Xác nhận action trong MongoDB transaction nguyên tử.
  - `POST /actions/:id/cancel`: Hủy action bản nháp.

- [x] **Step 1: Viết test cho luồng xác nhận và hủy action**

```javascript
// server/tests/chat.controller.test.js
const request = require('supertest');
const express = require('express');
const chatRoutes = require('../src/routes/chat.routes');
const ChatAction = require('../src/models/ChatAction');

jest.mock('../src/models/ChatAction');
jest.mock('../src/middleware/auth.middleware', () => (req, res, next) => {
  req.user = { id: '507f1f77bcf86cd799439011' };
  next();
});

const app = express();
app.use(express.json());
app.use('/api/chat', chatRoutes);

describe('Chat Controller Action Endpoints', () => {
  it('POST /actions/:id/cancel trả về thành công và cập nhật status sang cancelled', async () => {
    ChatAction.findOne.mockResolvedValue({
      _id: 'action123',
      userId: '507f1f77bcf86cd799439011',
      status: 'pending',
      save: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app).post('/api/chat/actions/action123/cancel');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại**

Run: `npm --prefix server test tests/chat.controller.test.js`
Expected: FAIL (Cannot find module '../src/routes/chat.routes')

- [x] **Step 3: Triển khai `chat.controller.js` và `chat.routes.js`**

- `sendMessage`: 
  - Khóa hội thoại bằng `lockExpiresAt` để tránh race condition khi gửi tin nhắn đồng thời.
  - Lưu tin nhắn vào `ChatConversation` (giới hạn 40 tin).
  - Trả về envelope `{ success: true, data: { conversationId, reply, facts, pendingAction } }`.
- `confirmAction`:
  - Kiểm tra `action.userId == req.user.id`.
  - Nếu action đã `confirmed`, trả lại ngay `resultSummary` (Idempotent, không ghi đúp).
  - Nếu action `cancelled` hoặc `expired` (hoặc `expiresAt < Date.now()`), trả về HTTP 410.
  - Gọi `runInTransaction(async (session) => { ... })`:
    - Với `create_transaction`: Kiểm tra số dư ví nếu là ví thường (balance >= amount); tạo record `Transaction` với session; gọi `applyDelta(walletId, delta, { session })`; cập nhật `action.status = 'confirmed'`, `action.resultId = tx._id`.
    - Với `create_budget`: Kiểm tra xem đã có budget cho `(userId, month, categoryId)` chưa. Nếu có rồi, throw error xung đột (HTTP 409); tạo record `Budget` với session; cập nhật `action.status = 'confirmed'`.
  - Sau khi `runInTransaction` hoàn tất, gọi `realtimeService.emitBalanceChange(...)` nếu là giao dịch tài chính.
- `cancelAction`: Chuyển status sang `cancelled`.

- [x] **Step 4: Chạy test unit và integration cho Controller**

Run: `npm --prefix server test tests/chat.controller.test.js`
Expected: PASS

- [x] **Step 5: Commit thay đổi Task 5**

```bash
git add server/src/controllers/chat.controller.js server/src/routes/chat.routes.js server/tests/chat.controller.test.js
git commit -m "feat(chatbot): implement chat controller va routes voi transaction execution"
```

---

### Task 6: Tích hợp Tuyến đường vào Server & Cập nhật Cấu hình Môi trường

**Files:**
- Modify: `server/src/index.js`
- Modify: `server/.env.example`
- Test: `server/tests/chat.integration.test.js`

**Interfaces:**
- Consumes: `app.use('/api/chat', chatRoutes)`.
- Produces: API endpoint `/api/chat` sẵn sàng phục vụ.

- [x] **Step 1: Viết test integration tổng thể cho `/api/chat` routes trên server instance**

```javascript
// server/tests/chat.integration.test.js
const request = require('supertest');
const app = require('../src/index');

describe('Chat API Integration Check', () => {
  it('GET /api/chat/conversations/invalid-id từ chối nếu không có token JWT (401)', async () => {
    const res = await request(app).get('/api/chat/conversations/invalid-id');
    expect(res.status).toBe(401);
  });
});
```

- [x] **Step 2: Chạy test để xác nhận thất bại (do route chưa gắn vào `src/index.js`)**

Run: `npm --prefix server test tests/chat.integration.test.js`
Expected: FAIL (404 Not Found)

- [x] **Step 3: Gắn `chatRoutes` vào `server/src/index.js` và cập nhật `server/.env.example`**

Trong `server/src/index.js`:
```javascript
const chatRoutes = require('./routes/chat.routes');
...
// 13. Chatbot tài chính thông minh (Gemini AI)
app.use('/api/chat', chatRoutes);
```

Trong `server/.env.example`:
```env
# Cấu hình Gemini AI Chatbot
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

- [x] **Step 4: Chạy lại test integration**

Run: `npm --prefix server test tests/chat.integration.test.js`
Expected: PASS

- [x] **Step 5: Commit thay đổi Task 6**

```bash
git add server/src/index.js server/.env.example server/tests/chat.integration.test.js
git commit -m "feat(chatbot): dang ky chat routes vao server express va cap nhat env example"
```

---

### Task 7: Xây dựng TypeScript API Client cho Phía Ứng dụng Frontend

**Files:**
- Create: `src/api/chat.ts`
- Test: `tests/unit/chatApi.test.ts`

**Interfaces:**
- Consumes: `src/api/config.ts` (`API_BASE_URL`), AsyncStorage token.
- Produces: Module `chatApi` xuất các phương thức `sendMessage`, `getConversation`, `confirmAction`, `cancelAction` cùng các interface TypeScript (`ChatMessage`, `ChatActionPreview`, `ChatResponse`).

- [x] **Step 1: Viết test cho `chatApi` client trong `tests/unit/chatApi.test.ts`**

```typescript
// tests/unit/chatApi.test.ts
import { chatApi } from '../../src/api/chat';

describe('chatApi TypeScript Client', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('sendMessage gửi payload đúng format và trả về ChatResponse', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          conversationId: 'c1',
          reply: 'Xin chào!',
          facts: {},
        },
      }),
    });

    const result = await chatApi.sendMessage({ message: 'Hi' }, 'mock-token');
    expect(result.data.reply).toBe('Xin chào!');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/chat/messages'),
      expect.objectContaining({ method: 'POST' })
    );
  });
});
```

- [x] **Step 2: Chạy test client**

Run: `npm test tests/unit/chatApi.test.ts`
Expected: FAIL (Cannot find module '../../src/api/chat')

- [x] **Step 3: Triển khai `src/api/chat.ts`**

Tạo đầy đủ các interfaces TypeScript:
- `ChatActionPreview`: `id`, `type`, `previewDetails`, `expiresAt`, `status`.
- `ChatMessage`: `id`, `role`, `content`, `facts`, `actionId`, `createdAt`.
- `ChatResponse`: `conversationId`, `reply`, `facts`, `pendingAction`.
- `chatApi`:
  - `sendMessage(params: { message: string; conversationId?: string }, token: string)`
  - `getConversation(conversationId: string, token: string)`
  - `confirmAction(actionId: string, token: string)`
  - `cancelAction(actionId: string, token: string)`

- [x] **Step 4: Chạy test và kiểm tra TypeScript typing toàn dự án**

Run: `npm test tests/unit/chatApi.test.ts`
Run: `npm run type-check`
Expected: ALL PASS (0 errors)

- [x] **Step 5: Commit thay đổi Task 7**

```bash
git add src/api/chat.ts tests/unit/chatApi.test.ts
git commit -m "feat(chatbot): them typescript api client chatApi cho frontend"
```

---

### Task 8: Chạy Toàn bộ Test Suite Hồi quy & Bàn giao KAN-34

**Files:**
- Test: Tất cả tests trong `server/tests/` và `tests/unit/`

- [x] **Step 1: Chạy toàn bộ test suite của server backend**

Run: `npm --prefix server test`
Expected: ALL PASS

- [x] **Step 2: Chạy toàn bộ test suite của client**

Run: `npm test`
Expected: ALL PASS

- [x] **Step 3: Kiểm tra `git status` và git diff đảm bảo sạch sẽ**

Run: `git status`
Expected: Clean working tree

- [x] **Step 4: Push nhánh lên remote repository**

```bash
git push origin feat/financial-center
```

- Tasks 1–4: implemented; final delivery verification recorded below. Native fetch and Gemini model/key configuration verified without exposing secrets; live Gemini skipped because no key/model is configured locally.
- Real MongoDB 7.0.14 replica-set tests verify repeated/concurrent confirm, cancellation races, rollback, ownership, duplicate budget, quota and late publication. A separate standalone test verifies 503 without data mutation.
- Ruling: retain compatible model fields and walletBalance session support from concurrent commits 68322ba/13d4516. Retain improved quota upsert race handling. Repair overwritten orchestration with regression tests; do not rewrite another process's commits.
- Review findings resolved: quota charged once, all function calls answered, one draft per turn, 20-message context, authoritative action state, bounded persistence/cleanup and server-time publication deadline.
- Ruling: conversation keeps its last action pointer after confirmation, with actionVersion incremented transactionally. This preserves confirmed status for follow-up chat while serializing replacement/confirmation.
- Concurrent process committed implementation as bfa7cd2 while final fixes were in progress. Delivery adds a separate KAN-34 fix commit and checks the remote branch.
- Final verification: 30 backend suites / 313 tests passed; 9 frontend suites / 37 tests passed; TypeScript type-check passed; dbSync syntax and git diff checks passed. Registered chat indexes in dbSync because production disables autoIndex. User authorized stopping concurrent worker; Orca confirmed its terminal process stopped before final delivery.
