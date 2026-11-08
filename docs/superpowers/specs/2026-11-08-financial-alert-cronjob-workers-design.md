# Đặc tả Thiết kế Kỹ thuật (Design Spec)
## Tính năng: Thiết lập Cronjob & Background Workers Tự động Phát hiện & Gửi Thông báo/Cảnh báo Tài chính (KAN-33)

- **Mã Task:** KAN-33
- **Dự án:** FinanceFlow
- **Ngày tạo:** 2026-11-08
- **Trạng thái:** Đã thống nhất thiết kế (Approved Design)
- **Tác giả:** Antigravity AI Assistant & Developer

---

### 1. Mục tiêu & Phạm vi (Objectives & Scope)

#### 1.1. Mục tiêu
1. **Tự động hóa phát hiện vượt ngưỡng ngân sách (Budget Threshold Alerts)**:
   - Theo dõi chi tiêu theo từng danh mục trong chu kỳ/tháng.
   - Khi chi tiêu chạm các mốc 50%, 80%, 100% hạn mức (`limitAmount`), hệ thống tự động phát hiện và gửi thông báo cảnh báo tức thì hoặc định kỳ.
   - Tôn trọng các tùy chọn người dùng: `alertThreshold50`, `alertThreshold80`, `alertThreshold100`.
   - Cơ chế khóa nguyên tử (Atomic locking) đảm bảo mỗi ngưỡng chỉ thông báo 1 lần trong chu kỳ, tuyệt đối không spam.
2. **Nhắc nhở mục tiêu tài chính & tích lũy tiết kiệm (Savings Goal Reminders)**:
   - Quét các mục tiêu tiết kiệm (`Goal`) có trạng thái `active`.
   - Nhắc nhở cận hạn (`deadline`): Phát hiện và gửi lời nhắc khi còn 7 ngày (`d-7`), 3 ngày (`d-3`), hoặc hôm nay (`d0`).
   - Nhắc nhở tích lũy định kỳ ngày nhận lương (`salaryDay`): Gửi lời nhắc nạp tiết kiệm vào ngày nhận lương hàng tháng của người dùng nếu tháng đó chưa tích lũy.
3. **Kênh phân phối thông báo đa nền tảng**:
   - Gửi **Push Notification** qua Expo Server SDK (`push.service.js`) tới thiết bị di động đã đăng ký `pushTokens`.
   - Phát sự kiện **Realtime Socket.io** (`realtime.service.js`) sự kiện `financial:alert` tới client đang kết nối (hỗ trợ cả Web & Mobile).
4. **Trải nghiệm người dùng Hybrid (Tức thì + Định kỳ)**:
   - *Tức thì*: Hook ngầm (non-blocking) ngay khi phát sinh giao dịch chi tiêu (`Transaction.create`).
   - *Định kỳ*: Cronjob chạy ngầm lúc 08:30 sáng hàng ngày (giờ Hà Nội UTC+7).

#### 1.2. Phạm vi (Scope)
- **Backend (`FinanceFlow/server`):**
  - Cập nhật Schema `Budget.js`: Thêm `notifiedThresholds: [Number]`.
  - Cập nhật Schema `Goal.js`: Thêm `notifiedStages: [String]` và `lastSalaryReminderMonth: String`.
  - Tạo mới dịch vụ lõi: `server/src/services/financialAlert.service.js`.
  - Cập nhật dịch vụ realtime: `server/src/services/realtime.service.js` bổ sung `emitFinancialAlert(userId, alertData)`.
  - Tạo mới worker / cronjob: `server/src/jobs/financialAlert.job.js`.
  - Đăng ký khởi chạy cronjob trong `server/src/index.js`.
  - Tích hợp hook non-blocking trong `server/src/controllers/transaction.controller.js`.
  - Viết bộ kiểm thử toàn diện `server/tests/financialAlert.test.js`.
- **Client (`FinanceFlow/src`):**
  - Mở rộng `src/services/socketService.ts`: Lắng nghe sự kiện `financial:alert`.
  - Mở rộng Store `src/store/useNotificationStore.ts` & Component `src/components/notification/BalanceToastBanner.tsx`: Hiển thị banner cảnh báo trực quan với màu sắc tương ứng (đỏ cho vượt ngưỡng 100%, vàng cho 80%, xanh cho tiết kiệm).

---

### 2. Kiến trúc Hệ thống & Luồng Dữ liệu (Architecture & Data Flow)

#### 2.1. Sơ đồ Luồng Tổng thể (Hybrid Flow)

```
[Luồng 1: Tức thì khi Chi tiêu]
Người dùng tạo Giao dịch chi tiêu (POST /api/transactions)
               │
               ▼
[transaction.controller: createTransaction]
  - Lưu Transaction thành công vào MongoDB
  - Cập nhật số dư Ví
               │
               ▼ (Non-blocking / Fire-and-forget)
[financialAlert.service: checkExpenseBudget(userId, categoryId, transactionDate)]
  - Lấy Budget tháng tương ứng
  - Tính tổng chi tiêu thực tế trong tháng
  - Tính % đã chi: (tổng chi / limitAmount) * 100
  - Kiểm tra mốc 100%, 80%, 50%
  - Kiểm tra cờ bật/tắt & atomic claim (findOneAndUpdate $addToSet)
  - Nếu claim thành công:
       ├─► push.service.sendToUser (Expo Push Notification)
       └─► realtime.service.emitFinancialAlert (Socket.io)


[Luồng 2: Định kỳ hàng ngày lúc 08:30 AM]
node-cron trigger lúc 08:30 (Asia/Ho_Chi_Minh)
               │
               ▼
[financialAlert.job: run(now)]
  ├─► [financialAlert.service: scanAllBudgets(now)]
  │     - Quét toàn bộ Budget active của tháng
  │     - Gửi cảnh báo cho các mốc chạm ngưỡng chưa thông báo
  │
  └─► [financialAlert.service: scanSavingsReminders(now)]
        - Quét toàn bộ Goal active
        - Nhánh Deadline: d-7, d-3, d0 (chống trùng bằng notifiedStages)
        - Nhánh Ngày lương (salaryDay): kiểm tra user.salaryDay và lastSalaryReminderMonth
        - Gửi push & socket notification
```

---

### 3. Thiết kế Chi tiết Backend (Backend Implementation Details)

#### 3.1. Cập nhật Model Schemas

##### 3.1.1. `server/src/models/Budget.js`
```javascript
// Bổ sung vào budgetSchema:
notifiedThresholds: {
  type: [Number], // Mảng lưu các mốc đã cảnh báo trong kỳ: [50, 80, 100]
  default: [],
}
```

##### 3.1.2. `server/src/models/Goal.js`
```javascript
// Bổ sung vào goalSchema:
notifiedStages: {
  type: [String], // Các mốc hạn chót đã cảnh báo: ['d-7', 'd-3', 'd0']
  default: [],
},
lastSalaryReminderMonth: {
  type: String, // Định dạng YYYY-MM (vd: '2026-11') ghi nhận tháng đã nhắc ngày lương
  default: null,
}
```

#### 3.2. Dịch vụ Cảnh báo Tài chính (`server/src/services/financialAlert.service.js`)

##### Các hằng số & hàm tiện ích:
- `VN_OFFSET_MS = 7 * 60 * 60 * 1000`
- `DAY_MS = 24 * 60 * 60 * 1000`
- `dayDiff(targetDate, now)`: Tính số ngày chênh lệch (làm tròn theo ngày lịch giờ VN).

##### Các hàm xử lý nghiệp vụ:
1. `getSpentAmount(userId, categoryId, monthStr)`:
   - Dùng `getPeriodRange('month', `${monthStr}-01`)` lấy `{ from, to }`.
   - `Transaction.aggregate` lọc `userId`, `categoryId`, `type: 'expense'`, `transactionDate` trong khoảng `[from, to)`.
   - Tính tổng `amount`.
2. `checkExpenseBudget(userId, categoryId, transactionDate)`:
   - Tìm Budget của user cho danh mục và tháng của `transactionDate`.
   - Tính tổng chi tiêu và phần trăm: `percent = Math.floor((spent / budget.limitAmount) * 100)`.
   - Xác định ngưỡng cao nhất đạt được mà chưa thông báo:
     - $percent \ge 100$ và `budget.alertThreshold100` và `!budget.notifiedThresholds.includes(100)` $\rightarrow$ Threshold 100
     - $percent \ge 80$ và `budget.alertThreshold80` và `!budget.notifiedThresholds.includes(80)` $\rightarrow$ Threshold 80
     - $percent \ge 50$ và `budget.alertThreshold50` và `!budget.notifiedThresholds.includes(50)` $\rightarrow$ Threshold 50
   - Khóa nguyên tử (Atomic Claim):
     ```javascript
     const claimed = await Budget.findOneAndUpdate(
       { _id: budget._id, notifiedThresholds: { $ne: threshold } },
       { $addToSet: { notifiedThresholds: threshold } },
       { new: true }
     );
     ```
   - Nếu `claimed !== null`, kích hoạt gửi:
     - Push Notification: Tiêu đề và nội dung phù hợp.
     - Realtime Socket.io: `emitFinancialAlert(userId, alertPayload)`.
3. `scanAllBudgets(now = new Date())`:
   - Lấy tháng hiện tại `currentMonth = YYYY-MM`.
   - Tìm tất cả `Budget.find({ month: currentMonth }).populate('categoryId', 'name icon color')`.
   - Chạy hàm đánh giá ngân sách cho từng bản ghi.
4. `scanSavingsReminders(now = new Date())`:
   - Tìm tất cả `Goal.find({ status: 'active' }).populate('userId', 'salaryDay')`.
   - **Xử lý Deadline**:
     - Nếu có `deadline` và `currentAmount < targetAmount`:
     - Tính `diff = dayDiff(goal.deadline, now)`.
     - Xác định stage: `diff === 7 ? 'd-7' : diff === 3 ? 'd-3' : diff === 0 ? 'd0' : null`.
     - Nếu có stage hợp lệ và `!goal.notifiedStages.includes(stage)`:
       - Atomic claim: `Goal.findOneAndUpdate({ _id: goal._id, status: 'active', notifiedStages: { $ne: stage } }, { $addToSet: { notifiedStages: stage } })`.
       - Gửi thông báo: Tiêu đề *"Nhắc nhở mục tiêu tiết kiệm"*, nội dung chi tiết số tiền còn thiếu và số ngày còn lại.
   - **Xử lý Ngày nhận lương**:
     - Lấy ngày hôm nay (giờ VN): `currentDay = getVNDay(now)`.
     - Nếu `currentDay === (user.salaryDay || 5)` và `goal.lastSalaryReminderMonth !== currentMonth` và `currentAmount < targetAmount`:
       - Atomic claim: `Goal.findOneAndUpdate({ _id: goal._id, status: 'active', lastSalaryReminderMonth: { $ne: currentMonth } }, { $set: { lastSalaryReminderMonth: currentMonth } })`.
       - Gửi thông báo: *"Hôm nay là ngày nhận lương! Đừng quên trích tiền tích lũy cho mục tiêu [Tên mục tiêu]."*

#### 3.3. Dịch vụ Realtime (`server/src/services/realtime.service.js`)
Thêm hàm:
```javascript
exports.emitFinancialAlert = (userId, alert) => {
  try {
    const io = socket.getIO();
    if (!io) return;
    io.to(`user_${userId}`).emit('financial:alert', {
      id: alert.id || `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: alert.type, // 'budget_alert' | 'savings_reminder'
      level: alert.level || 'warning', // 'info' | 'warning' | 'danger' | 'success'
      title: alert.title,
      body: alert.body,
      data: alert.data || {},
      timestamp: alert.timestamp || new Date().toISOString(),
    });
  } catch (err) {
    console.error('Lỗi khi phát sự kiện financial:alert:', err.message);
  }
};
```

#### 3.4. Cronjob Quản lý (`server/src/jobs/financialAlert.job.js`)
```javascript
const cron = require('node-cron');
const service = require('../services/financialAlert.service');

const TZ = 'Asia/Ho_Chi_Minh';

const run = async (now = new Date()) => {
  const budgetCount = await service.scanAllBudgets(now);
  const savingsCount = await service.scanSavingsReminders(now);
  return { budgetCount, savingsCount };
};

const start = () => {
  cron.schedule('30 8 * * *', () => {
    run().catch((err) => console.error('[financialAlert.job] Lỗi khi chạy cron:', err.message));
  }, { timezone: TZ });
};

module.exports = { start, run };
```

#### 3.5. Đăng ký Job trong `server/src/index.js`
```javascript
  if (process.env.ENABLE_CRON !== 'false') {
    require('./jobs/netWorth.job').start();
    require('./jobs/billReminder.job').start();
    require('./jobs/financialAlert.job').start();
  }
```

#### 3.6. Tích hợp Hook tức thì trong `server/src/controllers/transaction.controller.js`
Trong hàm `createTransaction`:
```javascript
  // Sau khi lưu Transaction thành công:
  if (type === 'expense') {
    financialAlertService
      .checkExpenseBudget(userId, categoryId, new Date(transactionDate || Date.now()))
      .catch((err) => console.error('[financialAlert] Lỗi kiểm tra ngân sách tức thì:', err.message));
  }
```

---

### 4. Thiết kế Phía Client (Client-Side Implementation Details)

#### 4.1. Lắng nghe Socket Event (`src/services/socketService.ts`)
- Định nghĩa interface `FinancialAlertPayload`:
  ```typescript
  export interface FinancialAlertPayload {
    id: string;
    type: 'budget_alert' | 'savings_reminder';
    level: 'info' | 'warning' | 'danger' | 'success';
    title: string;
    body: string;
    data?: any;
    timestamp: string;
  }
  ```
- Hàm `dispatchFinancialAlert(payload: FinancialAlertPayload)`:
  - Nếu `soundEnabled`, phát chuông nhẹ.
  - Nếu `toastEnabled`, chuyển tiếp vào `useNotificationStore` để hiển thị banner nổi.

#### 4.2. Mở rộng Store Thông báo & UI Banner
- Cập nhật `src/store/useNotificationStore.ts`:
  Hỗ trợ thêm kiểu thông báo `financial_alert` bên cạnh `balance_change`.
- Cập nhật `src/components/notification/BalanceToastBanner.tsx`:
  - Hiển thị icon tương ứng:
    - Vượt ngân sách: Icon `AlertTriangle` / `AlertCircle` màu đỏ/vàng.
    - Tiết kiệm: Icon `Target` / `PiggyBank` màu xanh.
  - Hiển thị rõ `title` và `body`.

---

### 5. Kế hoạch Kiểm thử & Tiêu chuẩn Nghiệm thu (Testing & Verification)

#### 5.1. Unit & Integration Test (`server/tests/financialAlert.test.js`)
1. **Kiểm thử Ngân sách (Budget Alerts)**:
   - Chi tiêu dưới 50%: Không có cảnh báo nào được gửi.
   - Chi tiêu chạm 50%: Gửi cảnh báo 50%, lưu `50` vào `notifiedThresholds`.
   - Chi tiêu chạm 80%: Gửi cảnh báo 80%, lưu `80` vào `notifiedThresholds`.
   - Chi tiêu vượt 100%: Gửi cảnh báo 100%, lưu `100` vào `notifiedThresholds`.
   - Chống gửi trùng: Khi đã gửi mốc 80%, lần kiểm tra sau dù chi tiêu vẫn ở mức 85% thì không gửi lại mốc 80%.
   - Cờ cấu hình: Tắt `alertThreshold80` thì khi đạt 80% không gửi cảnh báo.
2. **Kiểm thử Tiết kiệm (Savings Goal Reminders)**:
   - Cận hạn 7 ngày (`d-7`): Gửi đúng nội dung và lưu `d-7` vào `notifiedStages`.
   - Cận hạn 3 ngày (`d-3`): Gửi đúng nội dung và lưu `d-3` vào `notifiedStages`.
   - Ngày đến hạn (`d0`): Gửi đúng nội dung và lưu `d0`.
   - Quá khứ / Đã hoàn thành: Goal có `status: 'completed'` hoặc đã qua hạn không gửi.
   - Ngày lương (`salaryDay`): Đúng ngày nhận lương của user, gửi lời nhắc tiết kiệm và đánh dấu `lastSalaryReminderMonth`. Lần quét sau trong cùng tháng không gửi lại.
3. **Kiểm thử Cron Job Runner**:
   - Gọi `run()` mô phỏng ngày giờ cụ thể, kiểm tra tổng số thông báo phát ra.

#### 5.2. Tiêu chuẩn Nghiệm thu (Acceptance Criteria)
- [x] Toàn bộ 21 test suites hiện tại của server tiếp tục PASS (266+ tests).
- [x] Test suite mới `financialAlert.test.js` PASS 100%.
- [x] `npm run type-check` phía client không phát sinh lỗi TypeScript.
- [x] Git commit tuân thủ quy chuẩn `KAN-33`:  
  `feat(jobs): KAN-33 Thiet lap cronjob va background worker canh bao ngan sach va nhac nho tiet kiem`.
