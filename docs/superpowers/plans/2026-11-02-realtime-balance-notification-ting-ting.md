# Realtime Balance Notification ("Ting Ting") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng tính năng Thông báo biến động số dư thời gian thực ("Ting Ting") qua WebSocket (Socket.io), phát âm thanh chuông ngân hàng chân thực và hiển thị Floating Toast Banner trượt trên màn hình khi có giao dịch nạp tiền, chi tiêu, chuyển tiền.

**Architecture:** Server Express gắn Socket.io Server với cơ chế xác thực JWT và phân phòng `user_${userId}`; module `realtime.service.js` bắn sự kiện `balance:change` khi hoàn tất nạp ví, tạo giao dịch, thanh toán QR; Client kết nối qua `socket.io-client`, tự động kích hoạt bộ tạo âm thanh chuông ngân hàng `soundService.ts` (sóng sin C6-E6), hiển thị `BalanceToastBanner.tsx` trượt từ đỉnh màn hình và tự động đồng bộ số dư Dashboard; hỗ trợ cài đặt Bật/Tắt chuông và mô phỏng Offline Mock.

**Tech Stack:** Node.js, Express, Socket.io, socket.io-client, JWT, Web Audio API / Audio Synthesizer, Expo React Native, TypeScript, Zustand, Animated, Lucide Icons, Jest, Supertest.

**Spec:** `docs/superpowers/specs/2026-11-02-realtime-balance-notification-ting-ting-design.md`

## Global Constraints
- Socket.io Server phải xác thực handshake bằng JWT token (Bearer token); từ chối nếu thiếu token hoặc token không hợp lệ.
- Người dùng chỉ nhận được thông báo của chính mình qua phòng socket riêng biệt `user_${userId}`.
- Payload `balance:change` phải chứa: `type`, `direction` ('in' | 'out'), `amount`, `walletName`, `newBalance`, `note`, `timestamp`.
- Bộ tạo chuông ngân hàng `soundService.ts` phải tự tổng hợp nốt nhạc, 100% không phụ thuộc việc tải file mp3 từ internet để đảm bảo không bị lỗi 404/CORS/mất mạng.
- Giao diện Toast Banner phải gắn ở tầng cao nhất của ứng dụng (`App.tsx`), có hoạt ảnh trượt mượt mà và tự tắt sau 4 giây.
- Mọi thao tác nạp tiền hoặc tạo giao dịch khi chạy Offline (không bật server) vẫn phải phát chuông và hiển thị banner bình thường.

## Review Focus
1. Client kết nối Socket.io với token không hợp lệ hoặc đã hết hạn phải bị server từ chối kết nối ngay tại handshake.
2. Khi User A nạp tiền vào ví của mình, User B kết nối cùng lúc không được nhận sự kiện `balance:change` của User A.
3. Khi người dùng tắt "Âm thanh Ting Ting" trong Profile, giao dịch biến động số dư chỉ hiển thị banner mà không phát ra tiếng chuông.
4. Nút "Nghe thử chuông Ting Ting 🔔" trong Profile phải kích hoạt được âm thanh và banner mẫu ngay lập tức cả khi online và offline.
5. Sự kiện `balance:change` phải tự động gọi làm mới số dư ví và danh sách giao dịch trên Dashboard mà không cần người dùng thao tác kéo vuốt màn hình.

---

### Task 1: Backend Socket.io Server & JWT Handshake Authentication

**Files:**
- Modify: `server/package.json`
- Create: `server/src/socket.js`
- Modify: `server/src/index.js`
- Test: `server/tests/socket.auth.test.js`

**Interfaces:**
- Consumes: `http`, `socket.io`, `jsonwebtoken`.
- Produces: `initSocket(httpServer)` khởi tạo Socket.io instance, middleware xác thực handshake JWT, đưa socket vào room `user_${userId}`.

- [ ] **Step 1: Write the failing test for Socket.io JWT handshake authentication**

Tạo `server/tests/socket.auth.test.js`:
```javascript
const http = require('http');
const express = require('express');
const Client = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { initSocket, getIO } = require('../src/socket');

const SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';

describe('Socket.io Handshake Auth', () => {
  let server, ioInstance, port, clientSocket;

  beforeAll((done) => {
    const app = express();
    server = http.createServer(app);
    ioInstance = initSocket(server);
    server.listen(() => {
      port = server.address().port;
      done();
    });
  });

  afterAll((done) => {
    ioInstance.close();
    server.close(done);
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('rejects connection without token', (done) => {
    clientSocket = new Client(`http://localhost:${port}`, {
      transports: ['websocket'],
    });
    clientSocket.on('connect_error', (err) => {
      expect(err.message).toMatch(/token/i);
      done();
    });
  });

  it('accepts connection with valid token and joins user room', (done) => {
    const token = jwt.sign({ id: 'u_test_100', email: 'test@ff.vn' }, SECRET);
    clientSocket = new Client(`http://localhost:${port}`, {
      auth: { token: `Bearer ${token}` },
      transports: ['websocket'],
    });
    clientSocket.on('connect', () => {
      expect(clientSocket.connected).toBe(true);
      done();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow/server test server/tests/socket.auth.test.js`
Expected: FAIL do `socket.io` chưa cài đặt và `server/src/socket.js` chưa tồn tại.

- [ ] **Step 3: Install socket.io and implement server/src/socket.js & index.js**

- Cài đặt `socket.io` trên server:
  Run: `npm --prefix FinanceFlow/server install socket.io`
- Tạo `server/src/socket.js`:
  ```javascript
  const { Server } = require('socket.io');
  const jwt = require('jsonwebtoken');

  const JWT_SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';
  let io = null;

  exports.initSocket = (httpServer) => {
    io = new Server(httpServer, {
      cors: { origin: '*', methods: ['GET', 'POST'] },
    });

    io.use((socket, next) => {
      const rawToken = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
      if (!rawToken) {
        return next(new Error('Authentication error: Missing token'));
      }
      try {
        const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded;
        next();
      } catch (err) {
        return next(new Error('Authentication error: Invalid or expired token'));
      }
    });

    io.on('connection', (socket) => {
      const userId = socket.user?.id || socket.user?._id;
      if (userId) {
        socket.join(`user_${userId}`);
      }
    });

    return io;
  };

  exports.getIO = () => io;
  ```
- Cập nhật `server/src/index.js`:
  Tạo `http.createServer(app)`, gọi `initSocket(server)` và `server.listen(PORT)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow/server test server/tests/socket.auth.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add server/package.json server/package-lock.json server/src/socket.js server/src/index.js server/tests/socket.auth.test.js
git -C FinanceFlow commit -m "feat(backend): initialize socket.io server with jwt handshake authentication"
```

---

### Task 2: Backend Realtime Service & Event Triggers on Transactions

**Files:**
- Create: `server/src/services/realtime.service.js`
- Modify: `server/src/controllers/wallet.controller.js`
- Modify: `server/src/controllers/transaction.controller.js`
- Modify: `server/src/controllers/payment.controller.js`
- Test: `server/tests/realtime.service.test.js`

**Interfaces:**
- Consumes: `getIO()` từ `../socket`, `Wallet`, `Transaction`.
- Produces: `emitBalanceChange(userId, data)` bắn sự kiện `balance:change` tới phòng `user_${userId}`.

- [ ] **Step 1: Write the failing test for realtime service and triggers**

Tạo `server/tests/realtime.service.test.js`:
```javascript
const realtimeService = require('../src/services/realtime.service');
const { initSocket } = require('../src/socket');
const http = require('http');

describe('Realtime Service emitBalanceChange', () => {
  let ioMock;
  beforeEach(() => {
    ioMock = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    jest.spyOn(require('../src/socket'), 'getIO').mockReturnValue(ioMock);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should emit balance:change to user room', () => {
    const payload = {
      type: 'income',
      direction: 'in',
      amount: 500000,
      walletName: 'Ví tiền mặt',
      newBalance: 2000000,
      note: 'Nạp tiền',
    };
    realtimeService.emitBalanceChange('u_123', payload);
    expect(ioMock.to).toHaveBeenCalledWith('user_u_123');
    expect(ioMock.emit).toHaveBeenCalledWith('balance:change', expect.objectContaining({
      type: 'income',
      direction: 'in',
      amount: 500000,
      walletName: 'Ví tiền mặt',
      newBalance: 2000000,
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow/server test server/tests/realtime.service.test.js`
Expected: FAIL do `server/src/services/realtime.service.js` chưa tồn tại.

- [ ] **Step 3: Implement realtime.service.js and integrate in controllers**

- Tạo `server/src/services/realtime.service.js`:
  ```javascript
  const { getIO } = require('../socket');

  exports.emitBalanceChange = (userId, data) => {
    try {
      const io = getIO();
      if (!io) return;
      const payload = {
        ...data,
        timestamp: data.timestamp || new Date().toISOString(),
      };
      io.to(`user_${userId}`).emit('balance:change', payload);
    } catch (err) {
      console.error('Lỗi emit balance:change:', err.message);
    }
  };
  ```
- Tích hợp gọi `realtimeService.emitBalanceChange`:
  - Trong `server/src/controllers/wallet.controller.js` (`topup`): Phát `direction: 'in'` với `newBalance: updatedWallet.balance`.
  - Trong `server/src/controllers/transaction.controller.js` (`createTransaction`): Phát `direction: 'in'` (nếu income) hoặc `direction: 'out'` (nếu expense/transfer).
  - Trong `server/src/controllers/payment.controller.js` (`confirmIntent`): Phát `direction: 'out'` cho người thanh toán.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow/server test server/tests/realtime.service.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add server/src/services/realtime.service.js server/src/controllers/wallet.controller.js server/src/controllers/transaction.controller.js server/src/controllers/payment.controller.js server/tests/realtime.service.test.js
git -C FinanceFlow commit -m "feat(backend): implement realtime balance change event emission on transactions and topup"
```

---

### Task 3: Frontend Sound Engine & Settings Store

**Files:**
- Create: `src/services/soundService.ts`
- Create: `src/store/useSettingsStore.ts`
- Test: `tests/unit/sound.service.test.ts`

**Interfaces:**
- Consumes: `@react-native-async-storage/async-storage`, Web Audio API / Audio synthesizer.
- Produces:
  - `soundService.playChime(direction: 'in' | 'out')`: phát âm thanh ting-ting.
  - `useSettingsStore`: `soundEnabled`, `toastEnabled`, `setSoundEnabled`, `setToastEnabled`.

- [ ] **Step 1: Write the failing test for sound engine and settings store**

Tạo `tests/unit/sound.service.test.ts`:
```typescript
import { soundService } from '../../src/services/soundService';
import { useSettingsStore } from '../../src/store/useSettingsStore';

describe('Sound Service and Settings Store', () => {
  beforeEach(() => {
    useSettingsStore.setState({ soundEnabled: true, toastEnabled: true });
  });

  it('toggles soundEnabled setting', async () => {
    expect(useSettingsStore.getState().soundEnabled).toBe(true);
    await useSettingsStore.getState().setSoundEnabled(false);
    expect(useSettingsStore.getState().soundEnabled).toBe(false);
  });

  it('soundService exposes playChime without throwing', () => {
    expect(() => soundService.playChime('in')).not.toThrow();
    expect(() => soundService.playChime('out')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow test tests/unit/sound.service.test.ts`
Expected: FAIL do file service và store chưa tồn tại.

- [ ] **Step 3: Implement soundService.ts and useSettingsStore.ts**

- Tạo `src/services/soundService.ts`:
  Tạo bộ tổng hợp Web Audio với 2 nốt cao C6 ($1046.5\text{ Hz}$) và E6 ($1318.5\text{ Hz}$) giảm âm lượng hàm mũ cho tiền vào (+), và nốt thanh thoát A5 ($880\text{ Hz}$) cho tiền ra (-).
- Tạo `src/store/useSettingsStore.ts`:
  Lưu cấu hình vào AsyncStorage `@financeflow_app_settings`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow test tests/unit/sound.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add src/services/soundService.ts src/store/useSettingsStore.ts tests/unit/sound.service.test.ts
git -C FinanceFlow commit -m "feat(frontend): implement banking chime sound engine and settings store"
```

---

### Task 4: Frontend Notification Store & Floating Toast Banner UI

**Files:**
- Create: `src/store/useNotificationStore.ts`
- Create: `src/components/notification/BalanceToastBanner.tsx`
- Modify: `App.tsx`
- Test: `tests/unit/notification.store.test.ts`

**Interfaces:**
- Consumes: `useNotificationStore`, `lucide-react-native`, `Animated`.
- Produces: `<BalanceToastBanner />` gắn tại root `App.tsx`, hiển thị banner nổi trượt từ trên xuống khi nhận `notify(payload)`.

- [ ] **Step 1: Write test for notification store**

Tạo `tests/unit/notification.store.test.ts`:
```typescript
import { useNotificationStore } from '../../src/store/useNotificationStore';

describe('Notification Store', () => {
  it('enqueues and dismisses notification', () => {
    expect(useNotificationStore.getState().currentNotification).toBeNull();
    useNotificationStore.getState().notify({
      id: 'test_1',
      type: 'income',
      direction: 'in',
      amount: 500000,
      walletName: 'Ví tiền mặt',
      newBalance: 2500000,
      timestamp: new Date().toISOString(),
    });
    expect(useNotificationStore.getState().currentNotification?.amount).toBe(500000);
    useNotificationStore.getState().dismiss();
    expect(useNotificationStore.getState().currentNotification).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm --prefix FinanceFlow test tests/unit/notification.store.test.ts`

- [ ] **Step 3: Implement useNotificationStore, BalanceToastBanner.tsx and mount in App.tsx**

- Tạo `src/store/useNotificationStore.ts`.
- Tạo `src/components/notification/BalanceToastBanner.tsx`:
  - Animation trượt từ trên đỉnh (`translateY: -120` -> `0`).
  - Tự động đóng sau $4000\text{ ms}$.
  - Nút đóng `✕`.
  - Icon tiền vào (xanh) / tiền ra (đỏ) kèm số tiền và số dư mới.
- Trong `App.tsx`: Gắn `<BalanceToastBanner />` ở tầng ngoài cùng của `SafeAreaProvider`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow test tests/unit/notification.store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add src/store/useNotificationStore.ts src/components/notification/BalanceToastBanner.tsx App.tsx tests/unit/notification.store.test.ts
git -C FinanceFlow commit -m "feat(frontend): implement animated floating balance toast banner component and root mount"
```

---

### Task 5: Frontend Socket Client, Auto-refresh, Profile Settings & Offline Mock

**Files:**
- Modify: `package.json`
- Create: `src/services/socketService.ts`
- Modify: `src/screens/profile/ProfileScreen.tsx`
- Modify: `src/api/wallet.ts`
- Modify: `src/api/transaction.ts`
- Test: `tests/unit/socket.client.test.ts`

**Interfaces:**
- Consumes: `socket.io-client`, `useAuthStore`, `soundService`, `useNotificationStore`, `useTransactionStore`, `useSettingsStore`.
- Produces: Lắng nghe socket sự kiện `balance:change`, tự động làm mới số dư Dashboard, phát chuông và hiện toast; cài đặt Bật/Tắt và nút nghe thử trong `ProfileScreen`.

- [ ] **Step 1: Install socket.io-client in FinanceFlow**

Run: `npm --prefix FinanceFlow install socket.io-client@^4.8.1`

- [ ] **Step 2: Write test for socket service and offline notification dispatch**

Tạo `tests/unit/socket.client.test.ts`:
```typescript
import { dispatchBalanceNotification } from '../../src/services/socketService';
import { useNotificationStore } from '../../src/store/useNotificationStore';

describe('Socket Service and Local Dispatch', () => {
  it('dispatchBalanceNotification triggers notification store and format amount', () => {
    dispatchBalanceNotification({
      type: 'income',
      direction: 'in',
      amount: 1000000,
      walletName: 'MB Bank',
      newBalance: 15000000,
      note: 'Thưởng KPI',
    });
    const current = useNotificationStore.getState().currentNotification;
    expect(current).toBeDefined();
    expect(current?.amount).toBe(1000000);
    expect(current?.walletName).toBe('MB Bank');
  });
});
```

- [ ] **Step 3: Implement socketService.ts, update ProfileScreen.tsx and offline fallbacks**

- Tạo `src/services/socketService.ts`: Quản lý kết nối Socket.io, hàm `initSocketConnection(token)`, hàm `disconnectSocket()`, hàm `dispatchBalanceNotification(data)`.
- Cập nhật `src/screens/profile/ProfileScreen.tsx`: Bổ sung card "🔔 Thông báo & Âm thanh" với switch Bật/Tắt chuông và nút "Nghe thử chuông Ting Ting 🔔".
- Cập nhật `src/api/wallet.ts` và `src/api/transaction.ts`: Khi chạy offline fallback, tự động gọi `dispatchBalanceNotification` để âm thanh và banner hoạt động ngay cả khi chưa bật server Node.js.

- [ ] **Step 4: Run type check and full test suites**

Run: `npm --prefix FinanceFlow run type-check && npm --prefix FinanceFlow test && npm --prefix FinanceFlow/server test`
Expected: PASS (0 lỗi).

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add package.json package-lock.json src/services/socketService.ts src/screens/profile/ProfileScreen.tsx src/api/wallet.ts src/api/transaction.ts tests/unit/socket.client.test.ts
git -C FinanceFlow commit -m "feat(frontend): integrate socket client, auto-refresh dashboard, profile settings and offline mock"
```
