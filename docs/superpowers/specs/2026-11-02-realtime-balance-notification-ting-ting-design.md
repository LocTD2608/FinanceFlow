# Đặc tả Thiết kế Kỹ thuật (Design Spec)
## Tính năng: Thông báo Biến động Số dư Thời gian thực ("Ting Ting") qua WebSocket & Bộ tạo chuông Ngân hàng

- **Dự án:** FinanceFlow (BTL App)
- **Ngày tạo:** 2026-11-02
- **Trạng thái:** Đã thống nhất thiết kế (Approved Design)
- **Tác giả:** Antigravity AI Assistant & Developer

---

### 1. Mục tiêu & Phạm vi (Objectives & Scope)

#### Mục tiêu
1. Xây dựng kênh giao tiếp hai chiều thời gian thực (Realtime WebSocket) giữa Backend Node.js/Express và Client Expo React Native qua thư viện `socket.io`.
2. Khi phát sinh các giao dịch làm biến động số dư ví (Nạp tiền, Tạo giao dịch Thu/Chi, Chuyển khoản ví, Thanh toán QR), hệ thống lập tức phát tín hiệu Realtime tới tài khoản người dùng tương ứng.
3. Client phát âm thanh chuông ngân hàng ngân vang đặc trưng (**"Ting Ting"**) và hiển thị **Floating Toast Banner** trượt từ trên đỉnh màn hình xuống với số tiền xanh lá (+)/đỏ (-), số dư mới và tên ví.
4. Tự động đồng bộ số dư ví và danh sách giao dịch trên Dashboard ngay lập tức mà không cần người dùng kéo vuốt tải lại trang.
5. Cung cấp tùy chọn Bật/Tắt âm thanh và thông báo trong trang Cài đặt (Profile), kèm nút "Nghe thử chuông Ting Ting 🔔".
6. Hoạt động song song cả khi kết nối Backend Socket thật lẫn khi chạy chế độ Ngoại tuyến (Offline Mock) trên `AsyncStorage`.

#### Phạm vi (Scope)
- **Phía Backend (Node.js / Express / Socket.io / MongoDB):**
  - Cài đặt thư viện `socket.io` trên `FinanceFlow/server`.
  - Cập nhật `server/src/index.js` chuyển sang khởi tạo `http.createServer(app)` và gắn Socket.io Server.
  - Xây dựng module quản lý Socket: `server/src/socket.js` có middleware xác thực JWT token và phân luồng vào phòng riêng `user_${userId}`.
  - Xây dựng dịch vụ phát sự kiện tập trung `server/src/services/realtime.service.js` với hàm `emitBalanceChange(userId, data)`.
  - Tích hợp gọi phát sự kiện tại các điểm chốt giao dịch:
    - `wallet.controller.js` (`topup`): Bắn thông báo tiền vào (+) cho ví được nạp.
    - `transaction.controller.js` (`createTransaction`): Bắn thông báo tiền vào (+) hoặc tiền ra (-) hoặc chuyển ví.
    - `payment.controller.js` (`confirmIntent`): Bắn thông báo trừ tiền cho người gửi và cộng tiền cho người nhận (nếu có).
- **Phía Client (Expo / React Native / TypeScript):**
  - Cài đặt thư viện `socket.io-client` trên `FinanceFlow`.
  - Xây dựng dịch vụ kết nối `src/services/socketService.ts`: Lắng nghe sự kiện `balance:change`, tự động gọi làm mới dữ liệu Dashboard qua `useTransactionStore`, và chuyển tiếp thông tin tới Banner và Sound engine.
  - Xây dựng bộ tạo âm thanh chuông ngân hàng `src/services/soundService.ts`: Sử dụng `AudioContext` tổng hợp tần số 2 nốt cao C6 (1046.5Hz) và E6 (1318.5Hz) với độ ngân chuông (Exponential Decay), hoạt động 100% độc lập không cần file mp3 ngoài mạng.
  - Xây dựng Store quản lý cài đặt `src/store/useSettingsStore.ts`: Lưu trạng thái `soundEnabled` và `toastEnabled` vào `AsyncStorage`.
  - Xây dựng Store thông báo `src/store/useNotificationStore.ts`: Quản lý hàng đợi thông báo biến động số dư.
  - Xây dựng Component `src/components/notification/BalanceToastBanner.tsx`: Toast Banner nổi với hiệu ứng trượt mượt mà (Animated Slide-down), tự biến mất sau 4 giây.
  - Gắn `<BalanceToastBanner />` vào gốc ứng dụng `App.tsx` để hiển thị trên toàn bộ các màn hình.
  - Cập nhật `src/screens/profile/ProfileScreen.tsx`: Thêm mục "Thông báo & Âm thanh" với công tắc Bật/Tắt chuông và nút "Nghe thử chuông Ting Ting 🔔".
  - Hỗ trợ cơ chế Offline Mock: Khi thực hiện giao dịch trong trạng thái offline, client tự động kích hoạt thông báo và âm thanh cục bộ.

---

### 2. Kiến trúc Realtime & Luồng Dữ liệu (Realtime Architecture & Data Flow)

#### 2.1. Sơ đồ Luồng Hoạt động Realtime
```
[User A thực hiện Nạp tiền / Thanh toán / Chuyển khoản]
                        │
                        ▼
             Gửi HTTP API tới Backend
                        │
                        ▼
      [Express Controller: wallet / transaction / payment]
                        │
           Cập nhật MongoDB & Số dư Ví
                        │
                        ▼
       [realtime.service: emitBalanceChange]
                        │
        Phát Socket Event tới phòng `user_${userId}`:
                  'balance:change'
                        │
                        ▼ (WebSocket / Polling)
        [Client Socket Listener: socketService]
                        │
     ┌──────────────────┼──────────────────┐
     ▼                  ▼                  ▼
[useTransactionStore]   [soundService]     [useNotificationStore]
   Làm mới số dư         Phát chuông        Kích hoạt Toast Banner
  Dashboard tức thì      "Ting Ting"       trượt xuống trong 4 giây
```

#### 2.2. Cấu trúc Gói tin Sự kiện (`balance:change`)
```json
{
  "type": "income",
  "direction": "in",
  "amount": 500000,
  "walletId": "653b8f1a2...",
  "walletName": "Ví tiền mặt",
  "newBalance": 3500000,
  "currency": "VND",
  "note": "Nhận tiền nạp ví",
  "timestamp": "2026-11-02T19:25:00.000Z"
}
```

---

### 3. Thiết kế Backend (Socket.io & Event Service)

#### 3.1. Cấu hình Socket Server (`server/src/socket.js`)
* Khởi tạo với cấu hình CORS mở và hỗ trợ cả `websocket` lẫn `polling`.
* Middleware xác thực:
  ```javascript
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;
    if (!token) return next(new Error('Authentication error: Missing token'));
    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanToken, JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });
  ```
* Khi client kết nối:
  ```javascript
  io.on('connection', (socket) => {
    const userId = socket.user?.id || socket.user?._id;
    if (userId) {
      socket.join(`user_${userId}`);
    }
  });
  ```

#### 3.2. Dịch vụ Phát Tín hiệu (`server/src/services/realtime.service.js`)
* Hàm `emitBalanceChange(userId, data)`:
  Gửi sự kiện `balance:change` tới `io.to(`user_${userId}`).emit('balance:change', payload)`.

---

### 4. Thiết kế Frontend & Bộ phát Âm thanh (Client & Sound Engine)

#### 4.1. Bộ tạo Chuông Ngân hàng Chân thực (`src/services/soundService.ts`)
* **Thuật toán sóng âm (Web Audio Synthesizer)**:
  * Sử dụng `AudioContext` kết hợp các Oscillator nốt cao hình sin (Sine wave) và GainNode giảm âm lượng hàm mũ (Exponential decay).
  * **Nốt 1**: Tần số $1046.5\text{ Hz}$ ($C_6$), âm lượng khởi đầu $0.3$, giảm dần về $0$ trong $0.35$ giây.
  * **Nốt 2**: Sau $0.09$ giây, phát tiếp tần số $1318.5\text{ Hz}$ ($E_6$), âm lượng khởi đầu $0.35$, ngân vang trong $0.45$ giây.
  * Hiệu ứng kết hợp tạo ra tiếng chuông chuông ngân hàng ngân vang lảnh lót chuẩn "Ting-Ting" không tạp âm.
  * Với chiều Tiền ra (`direction === 'out'`), phát nốt thanh thoát $880\text{ Hz}$ ($A_5$) êm dịu báo trừ tiền thành công.

#### 4.2. Quản lý Trạng thái Cài đặt (`src/store/useSettingsStore.ts`)
```typescript
interface SettingsState {
  soundEnabled: boolean;
  toastEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => Promise<void>;
  setToastEnabled: (enabled: boolean) => Promise<void>;
  loadSettings: () => Promise<void>;
}
```

#### 4.3. Quản lý Hàng đợi Thông báo (`src/store/useNotificationStore.ts`)
```typescript
export interface BalanceNotification {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  direction: 'in' | 'out';
  amount: number;
  walletName: string;
  newBalance?: number;
  note?: string;
  timestamp: string;
}

interface NotificationState {
  currentNotification: BalanceNotification | null;
  notify: (notification: BalanceNotification) => void;
  dismiss: () => void;
}
```

---

### 5. Thiết kế Giao diện Toast Banner & Profile Settings

#### 5.1. Component `BalanceToastBanner.tsx`
* Đặt tại `src/components/notification/BalanceToastBanner.tsx`.
* Trạng thái trượt mượt mà bằng `Animated.timing`:
  * Ban đầu: `translateY: -120` (ẩn phía trên tai thỏ/status bar).
  * Khi có thông báo: Trượt xuống `translateY: 0` (cách mép an toàn $10\text{ px}$).
  * Hẹn giờ tự động trượt lên sau $4000\text{ ms}$.
* Giao diện Card bo tròn $16\text{ px}$, bóng mờ nhẹ:
  * Bên trái: Icon tròn xanh lá (Tiền vào) hoặc đỏ cam (Tiền ra).
  * Ở giữa:
    * Dòng 1: Tiêu đề "Biến động số dư" + Thời gian "Vừa xong".
    * Dòng 2: Số tiền to đậm màu sắc tương ứng (`+ 500.000 đ` hoặc `- 200.000 đ`).
    * Dòng 3: Tên ví + Số dư mới: `Số dư: 15.500.000 đ`.
  * Bên phải: Nút đóng `✕` hỗ trợ tắt ngay.

#### 5.2. Màn hình Cài đặt `ProfileScreen.tsx`
* Bổ sung mục "🔔 Thông báo & Âm thanh":
  * Switch: Âm thanh Ting Ting (Chuông biến động số dư).
  * Switch: Banner biến động số dư.
  * Nút bấm: "🔔 Nghe thử chuông Ting Ting" kèm bắn thông báo mẫu để người dùng/thầy cô kiểm tra tính năng ngay lập tức.

---

### 6. Đồng bộ Ngoại tuyến (Offline Mock Simulator)

* Khi người dùng nạp tiền hoặc tạo giao dịch trong trạng thái Offline (không có server Node.js):
  * Module `src/api/wallet.ts` và `src/api/transaction.ts` tự động phát thông báo qua `useNotificationStore.getState().notify(...)`.
  * Âm thanh chuông và Banner trượt hiển thị hoàn toàn bình thường, đảm bảo việc demo đồ án không bao giờ bị gián đoạn.

---

### 7. Kế hoạch Kiểm thử & Tiêu chí Nghiệm thu (Acceptance Criteria)

1. **AC-TT-01 (Backend Socket & Auth)**:
   - Khởi tạo Socket.io trên Express server; từ chối client không gửi JWT token hoặc token hết hạn.
   - User kết nối hợp lệ được đưa vào room `user_${userId}`.
2. **AC-TT-02 (Phát sự kiện khi Nạp tiền / Giao dịch)**:
   - Gọi API Nạp tiền ví (`POST /api/wallets/:id/topup`) -> Socket phát sự kiện `balance:change` với `direction: 'in'` và số dư mới.
   - Gọi API Tạo giao dịch chi (`POST /api/transactions`) -> Socket phát `balance:change` với `direction: 'out'`.
3. **AC-TT-03 (Âm thanh Ting Ting & Banner Client)**:
   - Nhận sự kiện `direction: 'in'` -> Phát chuỗi 2 nốt ngân vang "ting-ting" và hiện Banner số tiền xanh lá (+).
   - Nhận sự kiện `direction: 'out'` -> Phát chuông thanh toán và hiện Banner số tiền đỏ (-).
   - Tự động đóng banner sau 4 giây.
4. **AC-TT-04 (Tự động đồng bộ Dashboard)**:
   - Khi có thông báo biến động, số dư ví và danh sách giao dịch trên Dashboard tự động làm mới ngay mà không cần reload.
5. **AC-TT-05 (Cài đặt & Nghe thử chuông)**:
   - Vào Profile tắt "Âm thanh Ting Ting" -> Giao dịch tiếp theo không phát âm thanh.
   - Bấm nút "Nghe thử chuông Ting Ting" -> Chuông phát ngay lập tức kèm thông báo mẫu.
6. **AC-TT-06 (Hoạt động mượt mà cả Online và Offline Mock)**:
   - Thử nghiệm trên cả môi trường có server socket và môi trường offline không bật server đều hiển thị chuông và banner chuẩn xác.
