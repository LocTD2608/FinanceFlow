# Đặc tả Thiết kế Kỹ thuật (Design Spec)
## Tính năng: Đăng nhập bằng Google, Apple (iOS) và Facebook (Social Auth Hybrid)

- **Dự án:** FinanceFlow (BTL App)
- **Ngày tạo:** 2026-10-25
- **Trạng thái:** Chờ phê duyệt (Pending Approval)
- **Tác giả:** Antigravity AI Assistant & Developer

---

### 1. Mục tiêu & Phạm vi (Objectives & Scope)

#### Mục tiêu
1. Bổ sung các phương thức đăng nhập bằng mạng xã hội phổ biến: **Google**, **Apple (ưu tiên iOS / Web)** và **Facebook** vào màn hình đăng nhập `LoginScreen`.
2. Hỗ trợ cơ chế **Hybrid thông minh**:
   - Khi có cấu hình OAuth Client ID trong biến môi trường: Kích hoạt luồng OAuth 2.0 chuẩn.
   - Khi chạy môi trường phát triển (Dev/Demo/Chấm điểm đồ án): Cung cấp giao diện giả lập (Mock Modal) trực quan, cho phép chọn tài khoản mẫu (Google, Apple, Facebook) để đăng nhập ngay mà không bị chặn bởi rào cản chi phí Apple Developer ($99/năm) hay xác thực ứng dụng của Meta.
3. Đồng bộ dữ liệu người dùng mạng xã hội vào **MongoDB Atlas Cloud**, tự động khởi tạo ví và danh mục mặc định nếu là người dùng mới lần đầu đăng nhập.

#### Phạm vi (Scope)
- **Phía Client (Expo / React Native):**
  - Màn hình `LoginScreen.tsx`: Bổ sung dải phân cách "Hoặc tiếp tục với", hàng nút bấm Google, Apple (hiển thị có điều kiện trên iOS/Web), Facebook chuẩn phong cách nhận diện thương hiệu.
  - Component `SocialAuthModal.tsx`: Hộp thoại chọn nhanh tài khoản mạng xã hội để kiểm thử hoặc nhập thông tin giả lập.
  - Tích hợp gọi API `authApi.socialLogin` và lưu trạng thái vào `useAuthStore`.
- **Phía Server (Node.js / Express / MongoDB):**
  - Cập nhật Model `User.js`: Cho phép `passwordHash` không bắt buộc đối với người dùng đăng nhập bằng bên thứ 3; bổ sung trường `authProvider` và `oauthId`.
  - Bổ sung Endpoint `POST /api/auth/social-login`.
  - Đảm bảo cấp phát JWT Token tương thích 100% với các API hiện hành (`/api/categories`, `/api/transactions`, `/api/auth/me`).

---

### 2. Kiến trúc & Luồng dữ liệu (Architecture & Data Flow)

```
[Người dùng bấm nút Google / Apple / Facebook]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
[Có OAuth Client ID?]       [Chưa cấu hình / Demo Mode]
         │                           │
  Mở OAuth Web / SDK          Mở SocialAuthModal
         │                    (Chọn tài khoản mẫu)
         └─────────────┬─────────────┘
                       ▼
    Thu thập thông tin Profile:
    { provider, oauthId, email, name, avatar }
                       │
                       ▼
       Gửi POST /api/auth/social-login
                       │
                       ▼
              [Server Express]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
 [Email đã tồn tại]             [Người dùng mới]
       │                               │
 Cập nhật oauthId               Tạo User mới trong MongoDB
 (nếu cần)                      Tự động tạo Ví tiền mặt mặc định
       │                               │
       └───────────────┬───────────────┘
                       ▼
             Ký JWT (7 ngày)
                       ▼
        Trả về { success, user, token }
                       ▼
     Client lưu token vào useAuthStore
     Chuyển hướng vào Màn hình chính Dashboard
```

---

### 3. Chi tiết Thay đổi Kỹ thuật

#### 3.1. Cập nhật Model MongoDB (`server/src/models/User.js`)
- `passwordHash`: Đổi `required: false` (hoặc cung cấp giá trị mặc định cho OAuth user).
- `authProvider`:
  ```javascript
  authProvider: {
    type: String,
    enum: ['local', 'google', 'apple', 'facebook'],
    default: 'local',
  }
  ```
- `oauthId`:
  ```javascript
  oauthId: {
    type: String,
    sparse: true,
    index: true,
  }
  ```
- `avatar`: URL ảnh đại diện từ mạng xã hội.

#### 3.2. Endpoint API Backend (`POST /api/auth/social-login`)
- **Request Body:**
  ```json
  {
    "provider": "google",
    "oauthId": "google_123456789",
    "email": "user.demo@gmail.com",
    "username": "Nguyen Van A",
    "avatar": "https://...",
    "idToken": "optional_token_if_real"
  }
  ```
- **Validation:**
  - Kiểm tra `provider` thuộc `['google', 'apple', 'facebook']`.
  - Kiểm tra `email` hợp lệ (đối với Apple Private Relay, nếu người dùng ẩn email thì sử dụng email do Apple sinh ra `@privaterelay.appleid.com`).
- **Xử lý tài khoản:**
  - Tìm theo `oauthId` hoặc `email`.
  - Nếu đã tồn tại: Cập nhật `avatar`, `authProvider` (nếu chưa có).
  - Nếu chưa có: Tạo bản ghi `User` mới, sau đó tạo một `Wallet` mặc định ("Ví tiền mặt", số dư 0 VND) liên kết với `user._id`.
- **Response:**
  ```json
  {
    "success": true,
    "message": "Đăng nhập Google thành công!",
    "user": {
      "id": "6718d...",
      "username": "Nguyen Van A",
      "email": "user.demo@gmail.com",
      "authProvider": "google",
      "avatar": "https://..."
    },
    "token": "eyJhbGciOi..."
  }
  ```

#### 3.3. Giao diện Client (`LoginScreen.tsx` & Components)
1. **Quy chuẩn Apple Human Interface Guidelines:**
   - Nút Apple: Nền đen (`#000000`), chữ trắng, bo góc chuẩn mực theo card của app.
   - Chỉ hiển thị nút Apple trên nền tảng **iOS** (`Platform.OS === 'ios'`) hoặc **Web** (`Platform.OS === 'web'`). Ẩn trên Android theo đúng quy định của Apple.
2. **Quy chuẩn Google Identity Guidelines:**
   - Nút Google: Nền trắng (`#FFFFFF`), viền xám nhẹ (`#E2E8F0`), logo biểu tượng Google 4 màu chính hãng.
3. **Nút Facebook:**
   - Nền xanh đặc trưng (`#1877F2`), logo chữ f trắng.
4. **Hộp thoại Chế độ Demo (`SocialAuthModal`):**
   - Cho phép người dùng bấm thử nghiệm ngay các tài khoản đại diện:
     - 🔴 Google: `nguyenvana.demo@gmail.com`
     - 🍎 Apple: `apple.tester@privaterelay.appleid.com`
     - 🔵 Facebook: `fb.user.demo@facebook.com`
   - Có tùy chọn nhập nhanh tên và email tùy thích để test tạo tài khoản mới ngay trên MongoDB Atlas.

---

### 4. Kế hoạch Kiểm thử & Đảm bảo Chất lượng (QA/Test Plan)

1. **Test Case 1: Đăng nhập Google lần đầu (Tạo mới user & ví)**
   - Chọn Google -> Chọn tài khoản `demo.google@gmail.com`.
   - Kết quả mong đợi: Database tạo 1 Document user mới với `authProvider: 'google'`, tạo 1 ví mặc định, app đăng nhập vào Dashboard thành công.
2. **Test Case 2: Đăng nhập Google lần hai (Đã tồn tại)**
   - Bấm lại tài khoản Google cũ.
   - Kết quả mong đợi: Đăng nhập thành công, giữ nguyên số dư và dữ liệu cũ.
3. **Test Case 3: Đăng nhập Apple trên iOS / Web**
   - Kiểm tra nút hiển thị đúng trên iOS và Web, ẩn trên Android.
   - Bấm đăng nhập Apple -> kiểm tra thông tin hiển thị và token hợp lệ.
4. **Test Case 4: Đăng nhập Facebook**
   - Kiểm tra tạo user `authProvider: 'facebook'`.
5. **Test Case 5: Đăng nhập truyền thống (Username/Password)**
   - Xác minh tài khoản `admin` / `admin123` và `demo` / `123456` vẫn hoạt động bình thường, không bị ảnh hưởng.

---

### 5. Rủi ro & Giải pháp (Risks & Mitigations)

| Rủi ro | Mức độ | Giải pháp phòng ngừa |
| :--- | :---: | :--- |
| Trùng lặp email giữa tài khoản đăng ký thường và mạng xã hội | Trung bình | Backend tự động liên kết tài khoản nếu email trùng khớp thay vì báo lỗi. |
| Người dùng đăng nhập Apple chọn "Ẩn Email" (Private Relay) | Thấp | Server chấp nhận email đuôi `@privaterelay.appleid.com` từ Apple sinh ra làm định danh duy nhất. |
| Thiếu cấu hình API Key trên máy người chấm điểm bài tập lớn | Cao | Chế độ Demo/Mock tích hợp sẵn sẽ tự động kích hoạt mượt mà, không bao giờ gây lỗi sập ứng dụng. |
