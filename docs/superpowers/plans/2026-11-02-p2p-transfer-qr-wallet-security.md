# Kế hoạch Triển khai Chi tiết: Chuyển tiền P2P qua QR Code & Bảo mật Ví (P2P Transfer Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hệ thống chuyển tiền P2P thời gian thực giữa các người dùng thông qua mã QR (quét camera trực tiếp và mã QR cá nhân) kèm cơ chế bảo vệ ví nghiêm ngặt bằng mã PIN 6 số và Sinh trắc học (Face ID / Vân tay).

**Architecture:** Hệ thống Client-Server phân lớp với backend Express/MongoDB xử lý giao dịch nguyên tử (Atomic Transaction) đảm bảo tính toàn vẹn số dư, mã hóa PIN bằng bcrypt, chống brute-force và gửi thông báo Real-time qua Expo Push Service. Phía client Expo SDK 58 sử dụng `CameraView` quét QR, `react-native-qrcode-svg` sinh QR SVG có logo, `expo-local-authentication` cho sinh trắc học và hỗ trợ Offline Mock qua `AsyncStorage`.

**Tech Stack:** React Native (Expo SDK 58), TypeScript, `expo-camera`, `react-native-qrcode-svg`, `expo-local-authentication`, `expo-image-picker`, Node.js, Express, MongoDB/Mongoose, Jest.

**Spec:** [`docs/superpowers/specs/2026-11-02-p2p-transfer-qr-wallet-security-design.md`](file:///c:/BTL-App/FinanceFlow/docs/superpowers/specs/2026-11-02-p2p-transfer-qr-wallet-security-design.md)

## Global Constraints
- Expo SDK version: 58.0.0.
- Mã PIN: Đúng 6 chữ số, lưu trữ dưới dạng bcrypt hash, không lưu plain text.
- Khóa tài khoản sau tối đa 5 lần nhập sai mã PIN liên tiếp, thời gian khóa là 15 phút.
- Hạn mức chuyển tiền tối đa: 10.000.000 VND / giao dịch, tối thiểu 1.000 VND.
- Tuyệt đối không cho phép chuyển tiền cho chính mình (`recipientId !== senderId`).
- Tiền tố mã QR hợp lệ: `"app": "FinanceFlow"` và `"type": "P2P_RECEIVE"`.

## Review Focus
1. **Quét mã QR lạ (không phải của FinanceFlow):** Khi quét mã QR thanh toán ngân hàng khác hoặc URL web, app phải thông báo lỗi lịch sự, không bị crash hoặc đứng camera.
2. **Số dư ví người gửi không đủ:** Hệ thống từ chối giao dịch nguyên tử, hiển thị cảnh báo và nút "Nạp thêm tiền" mở TopupModal ngay lập tức.
3. **Mất mạng hoặc bấm đúp nút Chuyển tiền:** Sử dụng `idempotencyKey` để đảm bảo giao dịch chỉ được thực thi duy nhất 1 lần, không trừ tiền 2 lần.
4. **Nhập sai PIN 5 lần:** Tài khoản bị khóa 15 phút, app vô hiệu hóa bàn phím PIN và hiển thị nút "Quên mã PIN" để nhận OTP khôi phục qua email.
5. **Cấp quyền Camera bị từ chối:** Ứng dụng hiển thị thông báo hướng dẫn mở quyền trong Cài đặt và cung cấp nút chuyển sang tìm kiếm người nhận bằng SĐT/Username.

---

### Task 1: Cài đặt Thư viện Native Client (Expo SDK 58)

**Files:**
- Modify: `package.json`
- Modify: `app.json`

**Interfaces:**
- Produces: Modules `expo-camera`, `react-native-qrcode-svg`, `expo-local-authentication`, `expo-image-picker` tương thích Expo SDK 58.

- [ ] **Step 1: Cài đặt các package native bằng npx expo install**
```powershell
cd C:\BTL-App\FinanceFlow
npx expo install expo-camera react-native-qrcode-svg expo-local-authentication expo-image-picker
```

- [ ] **Step 2: Cập nhật cấu hình permissions trong `app.json`**
Bổ sung `plugins` cho `expo-camera` và `expo-local-authentication` trong `app.json`:
```json
"plugins": [
  "expo-asset",
  "expo-status-bar",
  [
    "expo-camera",
    {
      "cameraPermission": "Cho phép FinanceFlow truy cập Camera để quét mã QR thanh toán."
    }
  ],
  [
    "expo-local-authentication",
    {
      "faceIDPermission": "Cho phép FinanceFlow sử dụng Face ID để xác thực chuyển tiền nhanh chóng."
    }
  ]
]
```

- [ ] **Step 3: Kiểm tra tính toàn vẹn kiểu dữ liệu (TypeScript Check)**
Run: `npm run type-check`
Expected: PASS (0 errors)

- [ ] **Step 4: Commit thay đổi Task 1**
```bash
git add package.json package-lock.json app.json
git commit -m "chore: install expo-camera, qrcode-svg, local-auth, image-picker for SDK 58"
```

---

### Task 2: Backend - Mô hình Bảo mật Mã PIN & Bộ API Quản lý PIN

**Files:**
- Modify: `server/src/models/User.js`
- Create: `server/src/controllers/security.controller.js`
- Create: `server/src/routes/security.routes.js`
- Modify: `server/src/routes/index.js` (hoặc `server/src/app.js`)
- Test: `server/tests/security.pin.test.js`

**Interfaces:**
- Produces:
  - `GET /api/security/pin/status` -> `{ hasPin: boolean, isLocked: boolean, lockRemainingSeconds: number }`
  - `POST /api/security/pin/setup` -> Body: `{ pin: string, confirmPin: string }`
  - `POST /api/security/pin/verify` -> Body: `{ pin: string }`
  - `POST /api/security/pin/forgot` -> Gửi OTP khôi phục về Email
  - `POST /api/security/pin/reset-with-otp` -> Body: `{ otp: string, newPin: string }`

- [ ] **Step 1: Viết test thất bại (Failing Test) cho Security PIN Controller**
Tạo file `server/tests/security.pin.test.js` kiểm tra các luồng:
- Tạo PIN 6 số và băm bcrypt thành công.
- Nhập sai PIN tăng `failedPinAttempts`, sai 5 lần thì set `pinLockedUntil = now + 15m`.
- Gửi OTP và đặt lại PIN mở khóa tài khoản.

- [ ] **Step 2: Chạy test để xác nhận test FAIL**
Run: `cd server; npx jest tests/security.pin.test.js`
Expected: FAIL (Controller / Routes chưa tồn tại).

- [ ] **Step 3: Cập nhật `User.js` model**
Thêm các trường: `transactionPinHash`, `failedPinAttempts`, `pinLockedUntil`, `biometricEnabled`, `qrCodePayload`.

- [ ] **Step 4: Hiện thực `security.controller.js` và `security.routes.js`**
Hiện thực:
- `getPinStatus`: Kiểm tra `transactionPinHash != null`, kiểm tra `pinLockedUntil`.
- `setupPin`: Kiểm tra `/^\d{6}$/`, `bcrypt.hash(pin, 10)`.
- `verifyPin`: So sánh `bcrypt.compare(pin, user.transactionPinHash)`. Nếu sai quá 5 lần thì khóa 15 phút.
- `forgotPin`: Sinh OTP 6 số, băm và lưu tạm, gọi `mailService.sendOtpEmail`.
- `resetPinWithOtp`: Xác thực OTP, cập nhật PIN mới, giải phóng khóa.

- [ ] **Step 5: Đăng ký router vào `server/src/app.js` (hoặc `server/src/index.js`)**
Mount router tại `/api/security/pin` với middleware `auth`.

- [ ] **Step 6: Chạy test để xác nhận test PASS**
Run: `cd server; npx jest tests/security.pin.test.js`
Expected: PASS (All tests passing)

- [ ] **Step 7: Commit thay đổi Task 2**
```bash
git add server/src/models/User.js server/src/controllers/security.controller.js server/src/routes/security.routes.js server/tests/security.pin.test.js
git commit -m "feat(security): implement transaction pin management and brute-force protection"
```

---

### Task 3: Backend - API Chuyển tiền P2P & Tra cứu Người nhận

**Files:**
- Modify: `server/src/models/Transaction.js`
- Create: `server/src/controllers/p2p.controller.js`
- Create: `server/src/routes/p2p.routes.js`
- Modify: `server/src/routes/index.js`
- Test: `server/tests/p2p.transfer.test.js`

**Interfaces:**
- Consumes: `verifyPin` logic từ Task 2, `push.service.js`, `Wallet` model, `applyDeltas`.
- Produces:
  - `GET /api/p2p/lookup?query=...` -> `{ recipient: { id, username, nickname, avatar } }`
  - `POST /api/p2p/transfer` -> `{ success: true, transactionId, newBalance, recipientName }`

- [ ] **Step 1: Viết test thất bại (Failing Test) cho P2P Transfer**
Tạo file `server/tests/p2p.transfer.test.js`:
- Tra cứu user theo username/SĐT/Id (chặn tra cứu chính mình).
- Chuyển tiền thành công: Trừ tiền ví A, cộng tiền ví B, tạo 2 Transaction record (`transfer_out` và `transfer_in`).
- Từ chối khi số dư ví không đủ.
- Từ chối khi nhập sai PIN.
- Từ chối khi số tiền vượt 10.000.000 VND hoặc $\le 0$.
- Chống lặp giao dịch với `idempotencyKey`.

- [ ] **Step 2: Chạy test để xác nhận test FAIL**
Run: `cd server; npx jest tests/p2p.transfer.test.js`
Expected: FAIL.

- [ ] **Step 3: Cập nhật `Transaction.js` model**
Thêm enum values: `'transfer_out'`, `'transfer_in'`; thêm `counterpartUserId`, `counterpartName`, `transferNote`.

- [ ] **Step 4: Hiện thực `p2p.controller.js` và `p2p.routes.js`**
Hiện thực:
- `lookupRecipient`: Tìm user theo email / phone / username / _id. Bỏ qua thông tin nhạy cảm (chỉ trả về `_id`, `nickname`, `username`, `avatar`). Trả về 400 nếu trùng với `req.user.id`.
- `transfer`:
  1. Kiểm tra mã PIN với bcrypt (nếu sai quá 5 lần chặn và khóa).
  2. Kiểm tra `amount` ($1.000 \le \text{amount} \le 10.000.000$).
  3. Kiểm tra số dư ví nguồn.
  4. Mở session Mongoose transaction, thực hiện trừ ví gửi, cộng ví nhận, lưu 2 bản ghi `Transaction`.
  5. Gọi `pushService.sendToUser` gửi thông báo cho người nhận.

- [ ] **Step 5: Đăng ký router `/api/p2p` vào server**

- [ ] **Step 6: Chạy test để xác nhận test PASS**
Run: `cd server; npx jest tests/p2p.transfer.test.js`
Expected: PASS (All tests passing)

- [ ] **Step 7: Commit thay đổi Task 3**
```bash
git add server/src/models/Transaction.js server/src/controllers/p2p.controller.js server/src/routes/p2p.routes.js server/tests/p2p.transfer.test.js
git commit -m "feat(p2p): implement p2p recipient lookup and atomic transfer api"
```

---

### Task 4: Client - Service Tầng Mạng & Tiện ích QR Payload

**Files:**
- Create: `src/utils/qrPayload.ts`
- Create: `src/api/security.ts`
- Create: `src/api/p2p.ts`
- Test: `tests/unit/qrPayload.test.ts`

**Interfaces:**
- Produces:
  - `generateQRPayload(user: User, amount?: number, note?: string): string`
  - `parseQRPayload(raw: string): QRPayloadResult`
  - `securityApi.getPinStatus()`, `securityApi.setupPin()`, `securityApi.verifyPin()`
  - `p2pApi.lookup()`, `p2pApi.transfer()` (kèm Offline Fallback qua `AsyncStorage`)

- [ ] **Step 1: Viết test cho `qrPayload.ts`**
Tạo file `tests/unit/qrPayload.test.ts`:
- Test sinh mã QR tĩnh và QR động đúng JSON format.
- Test parse mã QR hợp lệ trả về đúng dữ liệu người nhận.
- Test parse mã QR lạ / chuỗi rác trả về lỗi `{ valid: false, error: '...' }`.

- [ ] **Step 2: Chạy test xác nhận test FAIL**
Run: `npm test tests/unit/qrPayload.test.ts`
Expected: FAIL (Chưa có hàm `generateQRPayload` và `parseQRPayload`).

- [ ] **Step 3: Hiện thực `src/utils/qrPayload.ts`**
Định nghĩa interface `QRPayloadData`, các hàm `encode` và `decode` an toàn với `try/catch`.

- [ ] **Step 4: Hiện thực `src/api/security.ts` & `src/api/p2p.ts`**
- Gọi API backend qua `fetch` / `axios` chuẩn theo token `useAuthStore`.
- Bổ sung cơ chế Offline Mock trên `AsyncStorage`: Khi server không phản hồi, tự động cập nhật số dư giả lập và tạo Transaction lưu vào local storage để demo đồ án không bao giờ bị gián đoạn.

- [ ] **Step 5: Chạy test xác nhận test PASS**
Run: `npm test tests/unit/qrPayload.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit thay đổi Task 4**
```bash
git add src/utils/qrPayload.ts src/api/security.ts src/api/p2p.ts tests/unit/qrPayload.test.ts
git commit -m "feat(client): add qr payload parser and p2p/security api clients with offline mock"
```

---

### Task 5: Client - Bộ Component Nhập Mã PIN & Sinh Trắc Học

**Files:**
- Create: `src/components/PinInputModal.tsx`
- Create: `src/components/PinSetupModal.tsx`
- Create: `src/components/ForgotPinModal.tsx`

**Interfaces:**
- Produces:
  - `<PinInputModal visible={bool} onConfirm={(pin) => void} onCancel={() => void} onForgotPin={() => void} error={string} />`
  - `<PinSetupModal visible={bool} onSuccess={() => void} onCancel={() => void} />`
  - `<ForgotPinModal visible={bool} onSuccess={() => void} onCancel={() => void} />`

- [ ] **Step 1: Hiện thực `PinInputModal.tsx`**
- Giao diện Bottom-sheet sang trọng: tiêu đề "Nhập mã PIN", 6 chấm tròn (dots) biểu thị trạng thái nhập.
- Bàn phím số cảm ứng 0-9 mượt mà, nút xóa Backspace.
- Tự động kiểm tra `LocalAuthentication.hasHardwareAsync()` và `isEnrolledAsync()`. Nếu có sinh trắc học, hiển thị biểu tượng FaceID / Vân tay ở góc bàn phím để gọi `LocalAuthentication.authenticateAsync()`.
- Xử lý đếm ngược khi bị tạm khóa (countdown timer 15 phút).

- [ ] **Step 2: Hiện thực `PinSetupModal.tsx` & `ForgotPinModal.tsx`**
- `PinSetupModal`: Gồm 2 bước: "Nhập mã PIN mới" $\to$ "Xác nhận lại mã PIN". Báo lỗi nếu 2 lần không khớp. Sau khi thành công, hỏi người dùng: *"Bật Face ID / Vân tay cho lần sau?"*.
- `ForgotPinModal`: Gửi OTP về email, nhập 6 số OTP, sau đó cho phép nhập mã PIN mới.

- [ ] **Step 3: Kiểm tra TypeScript Type-check**
Run: `npm run type-check`
Expected: PASS (0 errors).

- [ ] **Step 4: Commit thay đổi Task 5**
```bash
git add src/components/PinInputModal.tsx src/components/PinSetupModal.tsx src/components/ForgotPinModal.tsx
git commit -m "feat(ui): create custom pin keypad, setup modal, and biometric authenticator"
```

---

### Task 6: Client - Tái cấu trúc Màn hình Thanh toán (PaymentScreen) 2 Tabs

**Files:**
- Modify: `src/screens/payment/PaymentScreen.tsx`
- Create: `src/screens/payment/ScanQRTab.tsx`
- Create: `src/screens/payment/MyQRTab.tsx`
- Create: `src/screens/payment/DynamicQRModal.tsx`

**Interfaces:**
- Consumes: Task 1 (Expo Camera, QRCode SVG), Task 4 (QR parser, P2P API), Task 5 (Pin Modals).
- Produces: Màn hình Thanh toán hoàn chỉnh với 2 Tab `[Quét mã QR]` và `[Mã QR của tôi]`.

- [ ] **Step 1: Tạo `ScanQRTab.tsx`**
- Sử dụng `<CameraView>` từ `expo-camera` với `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}`.
- Khung ngắm định vị 4 góc phát sáng và hiệu ứng đường laser quét chuyển động nhẹ.
- Nút Flashlight (bật/tắt đèn chiếu sáng).
- Nút "Chọn ảnh từ album" dùng `ImagePicker.launchImageLibraryAsync` và quét mã từ ảnh.
- Ô tìm kiếm nhập Username/SĐT thủ công ở phía dưới camera.
- Khi phát hiện mã hợp lệ: gọi `parseQRPayload`, nếu đúng gọi callback `onScanned(recipientData)`.

- [ ] **Step 2: Tạo `MyQRTab.tsx` & `DynamicQRModal.tsx`**
- `MyQRTab.tsx`:
  - Hiển thị Card người nhận: Avatar, Tên, `@username`, Số dư ví hiện tại.
  - Vẽ mã QR SVG với `QRCode` từ `react-native-qrcode-svg` (có icon FinanceFlow ở tâm).
  - Nút "Tạo QR có số tiền": mở `DynamicQRModal` cho phép nhập số tiền và lời nhắn để tạo QR động.
  - Nút "Lưu ảnh QR" / "Chia sẻ".

- [ ] **Step 3: Tích hợp và Tái cấu trúc `PaymentScreen.tsx`**
- Thay thế mock QR cũ bằng thanh 2 Tab: `Quét mã QR` và `Mã QR của tôi`.
- Kết nối các bước luồng giao dịch:
  - Khi quét được QR hoặc chọn người nhận $\to$ Chuyển sang Bước **Nhập số tiền & Lời nhắn** (tự điền sẵn nếu là QR động).
  - Bấm "Tiếp tục" $\to$ Kiểm tra số dư (nếu thiếu mở `TopupModal`).
  - Mở `PinInputModal` (hoặc Face ID) $\to$ Nhập đúng $\to$ Gọi `p2pApi.transfer()`.
  - Thành công $\to$ Hiển thị **Biên lai giao dịch thành công** (Mã giao dịch, Người nhận, Số tiền, Thời gian, Số dư mới).

- [ ] **Step 4: Kiểm tra TypeScript Type-check**
Run: `npm run type-check`
Expected: PASS (0 errors).

- [ ] **Step 5: Commit thay đổi Task 6**
```bash
git add src/screens/payment/
git commit -m "feat(ui): redesign payment screen with dual-tab qr scanner, personal qr, and p2p transfer flow"
```

---

### Task 7: Đồng bộ Điều hướng & Kiểm thử Toàn diện Hệ thống

**Files:**
- Modify: `src/screens/dashboard/FinancialCenterScreen.tsx`
- Modify: `App.tsx`
- Test: `tests/unit/smoke.test.ts`

- [ ] **Step 1: Đồng bộ nút Quét QR từ Trang chủ**
Trong `FinancialCenterScreen.tsx`, nút biểu tượng QR ở thanh tiêu đề trên cùng được cấu hình để chuyển thẳng sang Tab Thanh toán ở chế độ `Quét mã QR`.

- [ ] **Step 2: Chạy kiểm thử tự động toàn diện phía Backend**
```powershell
cd C:\BTL-App\FinanceFlow\server
npm test
```
Expected: Toàn bộ test suites (bao gồm `security.pin.test.js`, `p2p.transfer.test.js` và các test hiện có) đều PASS.

- [ ] **Step 3: Chạy kiểm thử tự động và Type-check phía Client**
```powershell
cd C:\BTL-App\FinanceFlow
npm run type-check
npm test
```
Expected: 0 lỗi TypeScript, 100% tests PASS.

- [ ] **Step 4: Commit hoàn tất tính năng**
```bash
git add .
git commit -m "feat(p2p): complete qr p2p transfer and wallet security integration"
```
