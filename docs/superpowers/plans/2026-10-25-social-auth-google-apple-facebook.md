# Social Auth (Google, Apple, Facebook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai tính năng đăng nhập bằng Google, Apple (cho iOS/Web) và Facebook theo mô hình Hybrid (Backend API + Database MongoDB Atlas + UI chuẩn hãng + Mock/Demo mode).

**Architecture:** Mở rộng Model User trong MongoDB cho phép tài khoản không mật khẩu; xây dựng endpoint `POST /api/auth/social-login` tự động cấp phát JWT và ví mặc định; bổ sung hàng nút Social Login chuẩn Apple HIG / Google Brand Guidelines trên `LoginScreen` và component `SocialAuthModal` phục vụ kiểm thử mượt mà trên mọi môi trường.

**Tech Stack:** React Native (Expo SDK 52/57), Express.js, Mongoose / MongoDB Atlas Cloud, TypeScript, Jest, Supertest.

**Spec:** [docs/superpowers/specs/2026-10-25-social-auth-google-apple-facebook-design.md](file:///C:/BTL-App/FinanceFlow/docs/superpowers/specs/2026-10-25-social-auth-google-apple-facebook-design.md)

## Global Constraints

- Hỗ trợ cả 3 nền tảng: iOS, Android, Web.
- Nút Apple ("Sign in with Apple") chỉ hiển thị khi chạy trên iOS (`Platform.OS === 'ios'`) hoặc Web (`Platform.OS === 'web'`) theo đúng Apple HIG; ẩn trên Android.
- Không làm gián đoạn hoặc phá vỡ các tài khoản đăng nhập thường hiện có (`admin` / `admin123` và `demo` / `123456`).
- Người dùng mới tạo qua mạng xã hội phải được tự động gán một ví mặc định ("Ví tiền mặt", số dư 0 VND) để các màn hình Dashboard/Giao dịch không bị lỗi null pointer.
- Chế độ Fallback / Mock phải luôn sẵn sàng hoạt động ngay cả khi chưa có Apple Developer Program ($99/năm) hoặc Google Client ID.

## Review Focus

- User đăng nhập bằng Apple với tính năng "Ẩn email" (Private Relay dạng `...@privaterelay.appleid.com`): hệ thống vẫn định danh và tạo user thành công.
- User có email Google trùng với một user đã đăng ký bằng mật khẩu trước đó: hệ thống tự động liên kết tài khoản thay vì báo lỗi "Email đã tồn tại".
- User mạng xã hội chưa có mật khẩu: API đăng nhập thường không cho phép bypass bằng cách gửi mật khẩu rỗng.
- Khởi tạo ví mặc định cho user mạng xã hội: không tạo trùng ví nếu user đăng nhập lại lần thứ hai.
- Chuyển màn hình sau khi đăng nhập thành công: `onLoginSuccess` được kích hoạt và cập nhật tên người dùng lên Header/Dashboard.

---

### Task 1: Cập nhật Schema MongoDB User (`server/src/models/User.js`)

**Files:**
- Modify: `server/src/models/User.js`
- Test: `server/tests/user.model.test.js`

**Interfaces:**
- Consumes: Mongoose connection từ `server/src/config/db.js`
- Produces: `User` model hỗ trợ `authProvider: 'local' | 'google' | 'apple' | 'facebook'`, `oauthId: String`, `passwordHash` không bắt buộc khi `authProvider !== 'local'`.

- [ ] **Step 1: Viết test cho User Model**

```javascript
// server/tests/user.model.test.js
const mongoose = require('mongoose');
const User = require('../src/models/User');

describe('User Model Schema - Social Auth Support', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test_db');
  });
  afterAll(async () => {
    await mongoose.connection.close();
  });

  it('cho phép tạo user từ mạng xã hội không có passwordHash', async () => {
    const socialUser = new User({
      email: 'test.social@gmail.com',
      username: 'Social User',
      authProvider: 'google',
      oauthId: 'google_12345',
      avatar: 'https://example.com/avatar.png'
    });
    const err = socialUser.validateSync();
    expect(err).toBeUndefined();
  });

  it('bắt buộc passwordHash nếu authProvider là local', async () => {
    const localUser = new User({
      email: 'local.user@gmail.com',
      username: 'Local User',
      authProvider: 'local'
    });
    const err = localUser.validateSync();
    expect(err.errors.passwordHash).toBeDefined();
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `Set-Location "C:\BTL-App\FinanceFlow\server"; npx jest tests/user.model.test.js`
Expected: FAIL vì `passwordHash` hiện đang `required: true` bất kể authProvider.

- [ ] **Step 3: Cập nhật `server/src/models/User.js`**

Sửa `passwordHash` thành:
```javascript
passwordHash: {
  type: String,
  required: function() {
    return !this.authProvider || this.authProvider === 'local';
  },
},
authProvider: {
  type: String,
  enum: ['local', 'google', 'apple', 'facebook'],
  default: 'local',
},
oauthId: {
  type: String,
  sparse: true,
  index: true,
},
```

- [ ] **Step 4: Chạy lại test để xác nhận test thành công (Green)**

Run: `Set-Location "C:\BTL-App\FinanceFlow\server"; npx jest tests/user.model.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/models/User.js server/tests/user.model.test.js
git commit -m "feat(backend): support social auth fields in User schema"
```

---

### Task 2: Xây dựng API Backend Social Login (`POST /api/auth/social-login`)

**Files:**
- Modify: `server/src/index.js`
- Test: `server/tests/auth.social.test.js`

**Interfaces:**
- Consumes: `POST /api/auth/social-login` với body `{ provider, oauthId, email, username, avatar }`
- Produces: JSON `{ success: true, message: String, user: Object, token: String }`

- [ ] **Step 1: Viết test cho endpoint `POST /api/auth/social-login`**

```javascript
// server/tests/auth.social.test.js
const request = require('supertest');
const express = require('express');

describe('POST /api/auth/social-login', () => {
  it('tạo user mới và tự động tạo ví mặc định khi đăng nhập lần đầu', async () => {
    // Gửi request với email mới
    // Kỳ vọng HTTP 200, success: true, có token JWT và user.authProvider === 'google'
  });

  it('đăng nhập thành công và không tạo trùng ví đối với user đã tồn tại', async () => {
    // Gửi lại request với cùng email/oauthId
    // Kỳ vọng HTTP 200, trả về token hợp lệ
  });

  it('từ chối khi provider không hợp lệ', async () => {
    // Gửi provider: 'twitter'
    // Kỳ vọng HTTP 400
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận test thất bại (Red)**

Run: `Set-Location "C:\BTL-App\FinanceFlow\server"; npx jest tests/auth.social.test.js`
Expected: FAIL 404 (Route chưa tồn tại).

- [ ] **Step 3: Cài đặt logic `app.post('/api/auth/social-login')` trong `server/src/index.js`**

- Nhập `Wallet = require('./models/Wallet')`.
- Xử lý xác thực đầu vào (`provider`, `email`, `oauthId`, `username`).
- Tìm user theo `oauthId` hoặc `email`.
- Nếu chưa có: Tạo `User.create({ email, username, authProvider: provider, oauthId, avatar })`.
- Kiểm tra ví: nếu user chưa có `Wallet`, tạo `Wallet.create({ userId: user._id, name: 'Ví tiền mặt', balance: 0, currency: 'VND', isDefault: true })`.
- Ký JWT token (`jwt.sign`) thời hạn 7 ngày.
- Trả về kết quả status 200.

- [ ] **Step 4: Chạy lại test để xác nhận test thành công (Green)**

Run: `Set-Location "C:\BTL-App\FinanceFlow\server"; npx jest tests/auth.social.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/index.js server/tests/auth.social.test.js
git commit -m "feat(backend): add POST /api/auth/social-login endpoint"
```

---

### Task 3: Cập nhật Frontend Client API & Store (`src/api/auth.ts`, `useAuthStore.ts`)

**Files:**
- Modify: `src/api/auth.ts`
- Modify: `src/store/useAuthStore.ts`

**Interfaces:**
- Consumes: Backend endpoint `/api/auth/social-login`
- Produces: `authApi.socialLogin(payload)` trả về `Promise<AuthResponse>`

- [ ] **Step 1: Khai báo types và hàm `socialLogin` trong `src/api/auth.ts`**

```typescript
export interface SocialLoginPayload {
  provider: 'google' | 'apple' | 'facebook';
  oauthId: string;
  email: string;
  username: string;
  avatar?: string;
  idToken?: string;
}

// Thêm vào authApi object:
async socialLogin(payload: SocialLoginPayload): Promise<AuthResponse>
```

- [ ] **Step 2: Cập nhật `useAuthStore.ts` để lưu `avatar` và `authProvider` của user**

- [ ] **Step 3: Kiểm tra biên dịch TypeScript**

Run: `Set-Location "C:\BTL-App\FinanceFlow"; npm run type-check`
Expected: PASS không có lỗi type.

- [ ] **Step 4: Commit**

```bash
git add src/api/auth.ts src/store/useAuthStore.ts
git commit -m "feat(client): add socialLogin api and store integration"
```

---

### Task 4: Xây dựng Giao diện Social Buttons & Modal Test (`SocialAuthModal.tsx` & `LoginScreen.tsx`)

**Files:**
- Create: `src/components/auth/SocialAuthModal.tsx`
- Modify: `src/screens/auth/LoginScreen.tsx`

**Interfaces:**
- Consumes: `authApi.socialLogin`, `useAuthStore`, `Platform.OS`
- Produces: UI đăng nhập mạng xã hội hoàn chỉnh trên `LoginScreen`

- [ ] **Step 1: Tạo `SocialAuthModal.tsx`**

Modal pop-up đẹp mắt gồm:
- Header: Logo provider + Tên dịch vụ (Google, Apple, Facebook).
- Danh sách tài khoản mẫu để click đăng nhập ngay trong 1 click:
  - 🔴 Google: `Nguyễn Văn An (an.nguyen.google@gmail.com)`
  - 🍎 Apple: `Trần Thị Mai (mai.apple@privaterelay.appleid.com)`
  - 🔵 Facebook: `Lê Hoàng Long (long.fb@facebook.com)`
- Tùy chọn form nhập nhanh Email/Tên tùy chỉnh.
- Nút "Hủy".

- [ ] **Step 2: Tích hợp vào `LoginScreen.tsx`**

- Thêm dải phân cách nét mảnh: `──────── Hoặc tiếp tục với ────────` ngay dưới nút Đăng nhập chính.
- Tạo hàng nút Social Login:
  - Nút **Google**: Logo G đa màu, viền xám tinh tế.
  - Nút **Apple**: Nền đen, logo quả táo trắng, text "Tiếp tục với Apple". **Chỉ render khi `Platform.OS === 'ios' || Platform.OS === 'web'`**.
  - Nút **Facebook**: Nền xanh `#1877F2`, logo chữ f trắng.
- Gắn sự kiện `onPress` để mở `SocialAuthModal` với provider tương ứng.
- Khi chọn tài khoản: Gọi `authApi.socialLogin`, hiển thị spinner loading, nếu thành công gọi `onLoginSuccess(res.user.username)`.

- [ ] **Step 3: Kiểm tra biên dịch và test giao diện trên trình duyệt / Expo**

Run: `Set-Location "C:\BTL-App\FinanceFlow"; npm run type-check`
Expected: 0 lỗi biên dịch.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/SocialAuthModal.tsx src/screens/auth/LoginScreen.tsx
git commit -m "feat(ui): add apple, google, facebook login buttons and modal"
```

---

### Task 5: Kiểm thử Toàn diện (End-to-End) & Xác minh Dữ liệu MongoDB Atlas

**Files:**
- Verify: Toàn bộ luồng đăng nhập trên trình duyệt `http://localhost:8081` và Backend `http://localhost:5000`

- [ ] **Step 1: Kiểm tra đăng nhập Google**
  - Mở app -> bấm nút Google -> chọn tài khoản mẫu `an.nguyen.google@gmail.com`.
  - Xác nhận app đăng nhập thành công vào Dashboard.
  - Kiểm tra MongoDB: bản ghi user `an.nguyen.google@gmail.com` xuất hiện với `authProvider: 'google'` và 1 ví mặc định.

- [ ] **Step 2: Kiểm tra đăng nhập Apple**
  - Bấm nút Apple -> chọn tài khoản mẫu Private Relay.
  - Xác nhận đăng nhập thành công vào Dashboard.

- [ ] **Step 3: Kiểm tra đăng nhập Facebook**
  - Bấm nút Facebook -> chọn tài khoản mẫu.
  - Xác nhận đăng nhập thành công vào Dashboard.

- [ ] **Step 4: Kiểm tra tính hồi quy (Regression Test)**
  - Đăng xuất -> Đăng nhập lại bằng tài khoản `admin` / `admin123`.
  - Đăng xuất -> Đăng nhập lại bằng tài khoản `demo` / `123456`.
  - Xác nhận hệ thống đăng nhập truyền thống vẫn hoạt động hoàn hảo 100%.

- [ ] **Step 5: Commit hoàn tất tính năng**

```bash
git commit --allow-empty -m "chore: complete social auth feature verification"
```
