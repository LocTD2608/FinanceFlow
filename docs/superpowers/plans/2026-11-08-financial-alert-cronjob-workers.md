# Kế hoạch Triển khai (Implementation Plan): Cronjob & Background Workers Cảnh báo Tài chính (KAN-33)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thiết lập hệ thống Cronjob và Background Workers tự động phát hiện tình trạng tài chính (chạm ngưỡng ngân sách 50%, 80%, 100% và nhắc nhở tiết kiệm cận hạn / ngày lương), gửi thông báo đa kênh (Push Notification + Socket.io Realtime) và ngăn chặn trùng lặp tuyệt đối.

**Architecture:** Sử dụng kiến trúc Module hóa tách biệt giữa tầng dịch vụ nghiệp vụ (`financialAlert.service.js`) và tầng lập lịch (`financialAlert.job.js` chạy `node-cron`). Tích hợp luồng Hybrid gồm: hook ngầm tức thì sau khi tạo giao dịch chi tiêu (`Transaction.create`) và cronjob định kỳ quét tổng thể lúc 08:30 sáng hàng ngày (giờ Hà Nội UTC+7). Trạng thái đã cảnh báo được khóa nguyên tử bằng toán tử `$addToSet` trên MongoDB.

**Tech Stack:** Node.js, Express, MongoDB (Mongoose), node-cron, expo-server-sdk, socket.io, React Native (Expo), TypeScript, Jest.

**Spec:** [`docs/superpowers/specs/2026-11-08-financial-alert-cronjob-workers-design.md`](file:///C:/Users/truon/orca/workspaces/FinanceFlow/feat-financial-center/docs/superpowers/specs/2026-11-08-financial-alert-cronjob-workers-design.md)

## Global Constraints

- Múi giờ chuẩn: `Asia/Ho_Chi_Minh` (UTC+7).
- Chuẩn Git commit: `<type>(<scope>): KAN-33 <mô tả>` (ví dụ: `feat(jobs): KAN-33 Thiet lap cronjob va background worker canh bao tai chinh`).
- Giữ nguyên 100% độ tin cậy của 21 test suites hiện có trên server (266 passing tests).
- Đảm bảo hook chi tiêu tức thì là non-blocking (không làm lỗi hoặc chậm lưu `Transaction`).
- Khóa chống trùng thông báo (idempotent notification) bằng MongoDB atomic query.

## Review Focus

1. Ngân sách có `limitAmount = 0` hoặc chi tiêu bằng 0 không được chia cho 0 gây crash.
2. Nhiều luồng giao dịch đồng thời chạm ngưỡng ngân sách chỉ được gửi đúng 1 thông báo nhờ `$addToSet` atomic filter.
3. Người dùng tắt cờ cảnh báo (`alertThreshold50 = false`...) thì dù đạt mốc cũng không gửi thông báo.
4. Mục tiêu tiết kiệm đã có trạng thái `completed` hoặc `cancelled` không được gửi nhắc nhở cận hạn hay ngày lương.
5. Sự kiện `financial:alert` trên Socket.io không gây văng app khi client chưa đăng nhập hoặc socket ngắt kết nối.

---

### Task 1: Cập nhật Schema cho Models `Budget` và `Goal`

**Files:**
- Modify: `server/src/models/Budget.js`
- Modify: `server/src/models/Goal.js`
- Test: `server/tests/financialAlert.models.test.js`

**Interfaces:**
- `Budget`: Thêm trường `notifiedThresholds: { type: [Number], default: [] }`.
- `Goal`: Thêm trường `notifiedStages: { type: [String], default: [] }`, `lastSalaryReminderMonth: { type: String, default: null }`.

- [ ] **Step 1: Viết test kiểm tra Schema của Budget và Goal**
  Tạo `server/tests/financialAlert.models.test.js` kiểm tra các trường mới có trong schema và giá trị mặc định đúng.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  Chạy: `npm --prefix server test tests/financialAlert.models.test.js`
  Kỳ vọng: FAIL (các trường chưa được định nghĩa).

- [ ] **Step 3: Cập nhật `server/src/models/Budget.js` và `server/src/models/Goal.js`**
  Thêm định nghĩa các trường `notifiedThresholds`, `notifiedStages`, `lastSalaryReminderMonth`.

- [ ] **Step 4: Chạy test để xác nhận test PASS**
  Chạy: `npm --prefix server test tests/financialAlert.models.test.js`
  Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 1**
  ```bash
  git add server/src/models/Budget.js server/src/models/Goal.js server/tests/financialAlert.models.test.js
  git commit -m "feat(models): KAN-33 Bo sung truong luu trang thai thong bao cho Budget va Goal"
  ```

---

### Task 2: Mở rộng Dịch vụ Realtime Socket.io (`realtime.service.js`)

**Files:**
- Modify: `server/src/services/realtime.service.js`
- Test: `server/tests/realtime.service.test.js`

**Interfaces:**
- Produces: `emitFinancialAlert(userId: string, alert: { type, level, title, body, data, timestamp })`

- [ ] **Step 1: Viết unit test cho `emitFinancialAlert` trong `server/tests/realtime.service.test.js`**
  Test kiểm tra việc phát sự kiện `financial:alert` vào room `user_${userId}` với đầy đủ payload.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  Chạy: `npm --prefix server test tests/realtime.service.test.js`
  Kỳ vọng: FAIL (hàm `emitFinancialAlert` chưa tồn tại).

- [ ] **Step 3: Cài đặt hàm `emitFinancialAlert` trong `server/src/services/realtime.service.js`**
  Lấy socket io instance, bắn sự kiện `financial:alert` tới `user_${userId}` kèm error handling an toàn.

- [ ] **Step 4: Chạy test để xác nhận test PASS**
  Chạy: `npm --prefix server test tests/realtime.service.test.js`
  Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 2**
  ```bash
  git add server/src/services/realtime.service.js server/tests/realtime.service.test.js
  git commit -m "feat(realtime): KAN-33 Bo sung ham phat su kien realtime financial:alert qua socket"
  ```

---

### Task 3: Xây dựng Logic Cảnh báo Ngưỡng Ngân sách (`financialAlert.service.js`)

**Files:**
- Create: `server/src/services/financialAlert.service.js`
- Test: `server/tests/financialAlert.budget.test.js`

**Interfaces:**
- Produces:
  - `getSpentAmount(userId, categoryId, monthStr)`
  - `checkExpenseBudget(userId, categoryId, transactionDate)`
  - `scanAllBudgets(now)`

- [ ] **Step 1: Viết test cho logic đánh giá ngân sách trong `server/tests/financialAlert.budget.test.js`**
  - Đạt mốc 50%, 80%, 100%.
  - Kiểm tra cờ bật/tắt `alertThreshold50`, `alertThreshold80`, `alertThreshold100`.
  - Kiểm tra cơ chế atomic `$addToSet` chống gửi lặp.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  Chạy: `npm --prefix server test tests/financialAlert.budget.test.js`
  Kỳ vọng: FAIL (module chưa tồn tại).

- [ ] **Step 3: Cài đặt logic ngân sách trong `server/src/services/financialAlert.service.js`**
  - Tích hợp `getPeriodRange` từ `../utils/period.js`.
  - Tổng hợp chi phí danh mục qua `Transaction.aggregate`.
  - Khóa mốc bằng `Budget.findOneAndUpdate` với `$addToSet`.
  - Gửi push notification qua `push.service.js` và socket qua `realtime.service.js`.

- [ ] **Step 4: Chạy test để xác nhận test PASS**
  Chạy: `npm --prefix server test tests/financialAlert.budget.test.js`
  Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 3**
  ```bash
  git add server/src/services/financialAlert.service.js server/tests/financialAlert.budget.test.js
  git commit -m "feat(service): KAN-33 Xay dung service phat hien va canh bao nguong ngan sach"
  ```

---

### Task 4: Xây dựng Logic Nhắc nhở Mục tiêu Tiết kiệm (`financialAlert.service.js`)

**Files:**
- Modify: `server/src/services/financialAlert.service.js`
- Test: `server/tests/financialAlert.savings.test.js`

**Interfaces:**
- Produces:
  - `scanSavingsReminders(now)`
  - `dayDiff(targetDate, now)`

- [ ] **Step 1: Viết test cho logic nhắc nhở tiết kiệm trong `server/tests/financialAlert.savings.test.js`**
  - Nhắc nhở cận hạn deadline: mốc `d-7`, `d-3`, `d0`.
  - Không nhắc goal đã `completed` hoặc `cancelled`.
  - Nhắc nhở ngày nhận lương (`salaryDay`), chống gửi lặp 2 lần trong cùng tháng (`lastSalaryReminderMonth`).

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  Chạy: `npm --prefix server test tests/financialAlert.savings.test.js`
  Kỳ vọng: FAIL (`scanSavingsReminders` chưa hoàn thiện).

- [ ] **Step 3: Cài đặt logic nhắc nhở tiết kiệm vào `server/src/services/financialAlert.service.js`**
  - Tính toán `dayDiff` chuẩn giờ Việt Nam.
  - Quét `Goal.find({ status: 'active' })` có populate user.
  - Khóa mốc bằng atomic `$addToSet` và cập nhật `lastSalaryReminderMonth`.
  - Gửi push & socket notification.

- [ ] **Step 4: Chạy test để xác nhận test PASS**
  Chạy: `npm --prefix server test tests/financialAlert.savings.test.js`
  Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 4**
  ```bash
  git add server/src/services/financialAlert.service.js server/tests/financialAlert.savings.test.js
  git commit -m "feat(service): KAN-33 Xay dung service nhac nho muc tieu tiet kiem can han va ngay luong"
  ```

---

### Task 5: Xây dựng Cronjob Worker & Đăng ký Khởi động Server

**Files:**
- Create: `server/src/jobs/financialAlert.job.js`
- Modify: `server/src/index.js`
- Test: `server/tests/financialAlert.job.test.js`

**Interfaces:**
- Produces: `financialAlert.job.js`: `start()`, `run(now)`

- [ ] **Step 1: Viết test cho `financialAlert.job.js` trong `server/tests/financialAlert.job.test.js`**
  - Test hàm `run()` gọi đồng thời `scanAllBudgets` và `scanSavingsReminders`.
  - Test hàm `start()` đăng ký cron schedule với biểu thức `30 8 * * *` và timezone `Asia/Ho_Chi_Minh`.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  Chạy: `npm --prefix server test tests/financialAlert.job.test.js`
  Kỳ vọng: FAIL (job chưa được tạo).

- [ ] **Step 3: Cài đặt `server/src/jobs/financialAlert.job.js` và đăng ký trong `server/src/index.js`**
  - Tạo `financialAlert.job.js` tương tự cấu trúc chuẩn của `billReminder.job.js`.
  - Khởi chạy trong `server/src/index.js` khi `process.env.ENABLE_CRON !== 'false'`.

- [ ] **Step 4: Chạy test để xác nhận test PASS**
  Chạy: `npm --prefix server test tests/financialAlert.job.test.js`
  Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 5**
  ```bash
  git add server/src/jobs/financialAlert.job.js server/src/index.js server/tests/financialAlert.job.test.js
  git commit -m "feat(jobs): KAN-33 Xay dung cronjob financialAlert va dang ky vao server lifecycle"
  ```

---

### Task 6: Tích hợp Hook Ngân sách Tức thì trong Controller Giao dịch

**Files:**
- Modify: `server/src/controllers/transaction.controller.js`
- Test: `server/tests/transaction.controller.test.js`

**Interfaces:**
- Gọi `financialAlertService.checkExpenseBudget(userId, categoryId, transactionDate)` khi `type === 'expense'`.

- [ ] **Step 1: Bổ sung test case trong `server/tests/transaction.controller.test.js`**
  Kiểm tra khi tạo giao dịch chi tiêu, service kiểm tra ngân sách được gọi với đúng tham số và không chặn phản hồi HTTP nếu xảy ra lỗi.

- [ ] **Step 2: Chạy test để xác nhận test thất bại**
  Chạy: `npm --prefix server test tests/transaction.controller.test.js`
  Kỳ vọng: FAIL (hook chưa được gọi).

- [ ] **Step 3: Cập nhật `server/src/controllers/transaction.controller.js`**
  Import `financialAlertService` và gọi `checkExpenseBudget` non-blocking sau khi lưu giao dịch chi tiêu thành công.

- [ ] **Step 4: Chạy test để xác nhận test PASS**
  Chạy: `npm --prefix server test tests/transaction.controller.test.js`
  Kỳ vọng: PASS.

- [ ] **Step 5: Commit Task 6**
  ```bash
  git add server/src/controllers/transaction.controller.js server/tests/transaction.controller.test.js
  git commit -m "feat(transaction): KAN-33 Tich hop hook kiem tra nguong ngan sach tuc thi khi chi tieu"
  ```

---

### Task 7: Tích hợp Lắng nghe & Hiển thị Thông báo Cảnh báo Phía Client

**Files:**
- Modify: `src/services/socketService.ts`
- Modify: `src/store/useNotificationStore.ts`
- Modify: `src/components/notification/BalanceToastBanner.tsx`

**Interfaces:**
- Client nhận socket event `financial:alert` và hiển thị banner cảnh báo tương ứng.

- [ ] **Step 1: Mở rộng `src/store/useNotificationStore.ts`**
  Bổ sung hỗ trợ thông báo cảnh báo tài chính (title, message, level: info/warning/danger/success).

- [ ] **Step 2: Cập nhật `src/services/socketService.ts`**
  Lắng nghe `socket.on('financial:alert')` và kích hoạt store thông báo.

- [ ] **Step 3: Cập nhật `src/components/notification/BalanceToastBanner.tsx`**
  Hỗ trợ hiển thị banner cảnh báo với màu sắc và icon phù hợp.

- [ ] **Step 4: Kiểm tra type check phía client**
  Chạy: `npm run type-check`
  Kỳ vọng: PASS không có lỗi TypeScript.

- [ ] **Step 5: Commit Task 7**
  ```bash
  git add src/services/socketService.ts src/store/useNotificationStore.ts src/components/notification/BalanceToastBanner.tsx
  git commit -m "feat(client): KAN-33 Lang nghe su kien financial:alert va hien thi banner canh bao"
  ```

---

### Task 8: Kiểm thử Toàn diện & Xác thực Toàn bộ Hệ thống

**Files:**
- Verify: Toàn bộ backend test suites và client type-check

- [ ] **Step 1: Chạy toàn bộ test suites của Server**
  Chạy: `npm --prefix server test`
  Kỳ vọng: Tất cả test suites PASS 100%.

- [ ] **Step 2: Chạy kiểm tra TypeScript phía Client**
  Chạy: `npm run type-check`
  Kỳ vọng: 0 lỗi.

- [ ] **Step 3: Kiểm tra Git Log và Commit cuối cùng**
  Đảm bảo các commit đều tuân thủ mã KAN-33.
