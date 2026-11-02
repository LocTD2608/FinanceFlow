# Đặc tả Thiết kế Kỹ thuật (Design Spec)
## Tính năng: Chuyển tiền P2P qua QR Code, Quét Camera & Bảo vệ Số dư bằng Mã PIN / Sinh trắc học

- **Dự án:** FinanceFlow (BTL App)
- **Ngày tạo:** 2026-11-02
- **Trạng thái:** Đã thống nhất thiết kế (Approved Design)
- **Tác giả:** Antigravity AI Assistant & Developer

---

### 1. Mục tiêu & Phạm vi (Objectives & Scope)

#### 1.1. Mục tiêu
1. **Chuyển tiền Ngang hàng (P2P Transfer):** Cho phép người dùng chuyển tiền trực tiếp từ số dư ví của mình sang ví của người dùng khác trong hệ thống FinanceFlow trong thời gian thực.
2. **Mã QR Cá nhân & Quét Camera:**
   - Mỗi người dùng sở hữu một mã QR nhận tiền định danh duy nhất (QR tĩnh).
   - Hỗ trợ tạo mã QR yêu cầu thanh toán với số tiền và lời nhắn cụ thể (QR động).
   - Tích hợp Camera trực tiếp trong app bằng `expo-camera` (`CameraView`) kèm đèn Flash và hỗ trợ tải ảnh mã QR từ thư viện ảnh (`expo-image-picker`).
3. **Bảo mật Ví & Bảo vệ Tiền ảo:**
   - Bảo vệ giao dịch chuyển tiền bằng **Mã PIN giao dịch 6 chữ số** và **Sinh trắc học (Face ID / Vân tay qua `expo-local-authentication`)**.
   - Chống tấn công dò mã (Brute-force): Giới hạn tối đa 5 lần nhập sai liên tiếp, tự động khóa tạm thời 15 phút.
   - Hỗ trợ khôi phục / đặt lại mã PIN an toàn qua mã OTP gửi về Email.
4. **Toàn vẹn Dữ liệu & Giao dịch 2 chiều:**
   - Xử lý giao dịch nguyên tử (Atomic Database Transaction): Trừ tiền người gửi $\to$ Cộng tiền người nhận $\to$ Tạo 2 bản ghi giao dịch (`transfer_out` và `transfer_in`).
   - Ngăn chặn số dư âm, chống bấm đúp (`idempotencyKey`), giới hạn hạn mức tối đa 10.000.000đ/giao dịch.
   - Bắn thông báo đẩy tức thời (Push Notification qua `push.service.js`) tới thiết bị người nhận.
5. **Hỗ trợ Cơ chế Kép (Hybrid Sync):**
   - Hoạt động mượt mà với API Server Node.js / MongoDB thật.
   - Đồng thời hỗ trợ Offline Fallback qua `AsyncStorage` cho trường hợp không kết nối được backend khi demo/chấm điểm.

---

### 2. Mô hình Dữ liệu (Data Model & Schema)

#### 2.1. Cập nhật Model `User` (`server/src/models/User.js`)
Bổ sung các trường bảo mật và định danh QR:
```javascript
// Bổ sung vào userSchema:
transactionPinHash: {
  type: String,
  default: null, // null nếu chưa thiết lập PIN
},
failedPinAttempts: {
  type: Number,
  default: 0,
},
pinLockedUntil: {
  type: Date,
  default: null,
},
biometricEnabled: {
  type: Boolean,
  default: false,
},
qrCodePayload: {
  type: String,
  unique: true,
  sparse: true,
},
```

#### 2.2. Cập nhật Model `Transaction` (`server/src/models/Transaction.js`)
Mở rộng enum `type` và lưu vết đối tác giao dịch:
```javascript
// Mở rộng trường type:
type: {
  type: String,
  enum: ['expense', 'income', 'transfer', 'transfer_out', 'transfer_in'],
  required: true,
},
// Đối tác nhận/chuyển tiền:
counterpartUserId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'User',
  default: null,
},
counterpartName: {
  type: String,
  trim: true,
  default: '',
},
transferNote: {
  type: String,
  trim: true,
  default: '',
},
```

---

### 3. Cấu trúc Mã QR (QR Code Payload Specification)

Chuỗi dữ liệu lưu trong mã QR là chuỗi JSON mã hóa UTF-8 với định dạng tiêu chuẩn:
```json
{
  "app": "FinanceFlow",
  "version": "1.0",
  "type": "P2P_RECEIVE",
  "recipientId": "653b8f10a91f4b23c8901234",
  "username": "hoanglien",
  "nickname": "Hoàng Ngọc Liên",
  "phone": "0987654321",
  "amount": 0,
  "note": ""
}
```
* **QR tĩnh:** `amount = 0`, `note = ""`. Người quét sẽ nhập số tiền và nội dung chuyển.
* **QR động:** `amount > 0` và có `note`. Khi quét, hệ thống tự động điền sẵn số tiền và lời nhắn, khóa ô số tiền hoặc cho phép sửa tùy cấu hình.
* **Validation:** App kiểm tra tiền tố `"app": "FinanceFlow"` và `"type": "P2P_RECEIVE"`. Nếu không khớp, hiển thị cảnh báo: *"Mã QR không thuộc hệ thống FinanceFlow hoặc không hợp lệ"*.

---

### 4. Đặc tả API Backend (RESTful Endpoints)

#### 4.1. Nhóm API Quản lý Mã PIN (`/api/security/pin`)

1. **`GET /api/security/pin/status`**
   - **Mục đích:** Kiểm tra user đã cài mã PIN chưa, có bị khóa không.
   - **Response:**
     ```json
     {
       "success": true,
       "data": {
         "hasPin": true,
         "isLocked": false,
         "lockRemainingSeconds": 0,
         "biometricEnabled": true
       }
     }
     ```

2. **`POST /api/security/pin/setup`**
   - **Body:** `{ "pin": "123456", "confirmPin": "123456" }`
   - **Xử lý:** Kiểm tra định dạng 6 chữ số, băm bcrypt và lưu vào `transactionPinHash`.

3. **`POST /api/security/pin/verify`**
   - **Body:** `{ "pin": "123456" }`
   - **Xử lý:**
     - Nếu `pinLockedUntil > now`: Trả về `403` kèm thời gian chờ còn lại.
     - Kiểm tra mã PIN. Nếu sai: tăng `failedPinAttempts`. Nếu sai $\ge 5$: đặt `pinLockedUntil = now + 15m`.
     - Nếu đúng: reset `failedPinAttempts = 0`, trả về `success: true`.

4. **`POST /api/security/pin/forgot`**
   - **Xử lý:** Tạo mã OTP 6 số ngẫu nhiên, gửi qua `mailService.sendOtpEmail` đến email của user.

5. **`POST /api/security/pin/reset-with-otp`**
   - **Body:** `{ "otp": "654321", "newPin": "123456" }`
   - **Xử lý:** Xác thực OTP, cập nhật PIN mới, mở khóa tài khoản (`failedPinAttempts = 0`, `pinLockedUntil = null`).

---

#### 4.2. Nhóm API Chuyển tiền P2P (`/api/p2p`)

1. **`GET /api/p2p/lookup?query=...`**
   - **Tham số:** `query` có thể là `userId`, `username`, hoặc `phone`.
   - **Mục đích:** Tìm kiếm thông tin người nhận trước khi chuyển tiền để người gửi xác nhận đúng họ tên/avatar.
   - **Chặn tự chuyển:** Không cho phép chuyển tiền cho chính tài khoản đang đăng nhập.

2. **`POST /api/p2p/transfer`**
   - **Body:**
     ```json
     {
       "recipientId": "653b8f10a91f4b23c8901234",
       "amount": 100000,
       "note": "Trả tiền cơm trưa",
       "pin": "123456",
       "idempotencyKey": "uuid-v4-client-generated"
     }
     ```
   - **Quy trình xử lý giao dịch:**
     1. Xác thực danh tính người gửi và người nhận (`recipientId !== senderId`).
     2. Xác thực mã PIN người gửi (xử lý brute-force check).
     3. Kiểm tra hạn mức giao dịch: $1.000 \le \text{amount} \le 10.000.000$ VND.
     4. Kiểm tra số dư ví khả dụng của người gửi: `wallet.balance >= amount`.
     5. Mở MongoDB Session Transaction:
        * Trừ số dư ví người gửi (`balance -= amount`) $\to$ Ghi Transaction loại `transfer_out`.
        * Cộng số dư ví người nhận (`balance += amount`) $\to$ Ghi Transaction loại `transfer_in`.
     6. Commit Transaction.
     7. Gọi `push.service.sendToUser(recipientId, { title: "Tiền vào ví!", body: "Bạn vừa nhận được 100.000đ từ Hoàng Ngọc Liên" })`.
     8. Trả về thông tin giao dịch hoàn tất và số dư mới.

---

### 5. Thiết kế Giao diện Client (UI/UX Architecture)

#### 5.1. Tái cấu trúc Màn hình `PaymentScreen.tsx`
Màn hình được chia làm 2 Tab chuyển đổi linh hoạt:
* **Tab 1: Quét mã QR (`Scan QR`):**
  * Tích hợp `CameraView` từ `expo-camera` toàn màn hình / khung quét tiêu chuẩn.
  * Lớp phủ (Overlay) khung quét 4 góc phát sáng và vạch quét laser xanh động.
  * Nút bật/tắt Flash (`torch`) góc trên.
  * Nút "Chọn ảnh từ album" (`expo-image-picker`) góc dưới.
  * Ô nhập tìm kiếm: *"Nhập SĐT hoặc Username người nhận"* dành cho trường hợp không thể quét camera.
* **Tab 2: Mã nhận tiền của tôi (`My QR Code`):**
  * Thẻ Card nổi bật: Avatar, Tên hiển thị, Username `@hoanglien`.
  * Mã QR SVG vector sắc nét sinh bởi `react-native-qrcode-svg` có logo FinanceFlow ở giữa.
  * Hiển thị số dư ví hiện tại.
  * Nút **"Tạo mã kèm số tiền"**: Mở modal nhập số tiền + lời nhắn để sinh QR động.
  * Nút **"Lưu ảnh QR" / "Chia sẻ"**.

#### 5.2. Luồng Xác nhận & Bảo mật
1. **Bước Nhập số tiền & Lời nhắn:**
   * Hiển thị thẻ thông tin người nhận (Avatar, Nickname, Username).
   * Ô nhập tiền lớn, có các chip chọn nhanh: `+50k`, `+100k`, `+200k`, `+500k`, `Tất cả`.
   * Cảnh báo số dư ví kèm nút Nạp tiền (`TopupModal`) nếu không đủ số dư.
2. **Bước Xác thực Bảo mật:**
   * Tự động gọi Face ID / Vân tay qua `expo-local-authentication` nếu thiết bị hỗ trợ và người dùng đã bật.
   * Nếu không dùng sinh trắc học: Mở bottom-sheet bàn phím số 6 chấm tròn (dots) tùy biến để nhập mã PIN.
   * Có nút *"Quên mã PIN?"* để chuyển sang luồng nhận OTP qua Email.
3. **Bước Biên lai Thành công:**
   * Hoạt ảnh dấu tích xanh.
   * Chi tiết biên lai đầy đủ: Số tiền, Người nhận, Thời gian, Mã giao dịch, Số dư còn lại.
   * Nút "Chia sẻ biên lai" và "Về trang chủ".

---

### 6. Danh sách Thư viện Mới Cần Cài Đặt (Expo SDK 58)

Chạy lệnh cài đặt với `npx expo install`:
1. `expo-camera` (~16.0.x / compatible with SDK 58): Quét mã QR trực tiếp qua CameraView.
2. `react-native-qrcode-svg` (^6.3.x): Sinh mã QR SVG cá nhân.
3. `expo-local-authentication` (~15.0.x): Xác thực Face ID / Touch ID.
4. `expo-image-picker` (~16.0.x): Tải ảnh QR có sẵn từ thư viện ảnh.

---

### 7. Kế hoạch Kiểm thử (Testing Strategy)

1. **Kiểm thử Tự động Backend (Jest):**
   * `server/tests/security.pin.test.js`:
     * Test thiết lập mã PIN 6 số và băm bcrypt.
     * Test xác thực PIN đúng / sai, kiểm tra khóa tài khoản khi sai 5 lần.
     * Test luồng gửi OTP email và đặt lại PIN.
   * `server/tests/p2p.transfer.test.js`:
     * Test chuyển tiền thành công giữa 2 user (số dư ví gửi giảm, số dư ví nhận tăng tương ứng).
     * Test từ chối khi số dư không đủ.
     * Test từ chối khi chuyển tiền cho chính mình hoặc vượt hạn mức 10.000.000đ.
     * Test chống trùng giao dịch với `idempotencyKey`.
2. **Kiểm thử Client & Tính toàn vẹn Hệ thống:**
   * Chạy `npm run type-check` đảm bảo 0 lỗi TypeScript.
   * Chạy `npm test` trên cả client và server đảm bảo toàn bộ bài test hiện có đều PASS.
   * Kiểm thử thực tế trên iPhone với Expo Go SDK 58.

---

### 8. Đánh giá Rủi ro & Giải pháp (Risks & Mitigations)

| Rủi ro | Giải pháp kỹ thuật |
| :--- | :--- |
| **Quyền Camera bị từ chối** | Hiển thị màn hình hướng dẫn cấp quyền rõ ràng trong Cài đặt + luôn có tùy chọn nhập SĐT/Username để chuyển tiền mà không cần camera. |
| **Người dùng quên mã PIN** | Tích hợp sẵn luồng khôi phục PIN bằng mã OTP gửi về Email thông qua `mailService.js` đã hoạt động ổn định. |
| **Mất kết nối mạng giữa chừng khi chuyển tiền** | Sử dụng Database Transaction (nguyên tử) và `idempotencyKey` đảm bảo không bao giờ bị trừ tiền 2 lần hoặc tiền bị treo lơ lửng. |
| **Demo đồ án khi backend chưa chạy** | Bổ sung module Offline Fallback trong `src/api/p2p.ts` lưu dữ liệu tạm trên `AsyncStorage` để test giao diện mọi lúc. |
