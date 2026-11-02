# Đặc tả Thiết kế Kỹ thuật (Design Spec)
## Tính năng: Cơ chế Phân quyền Người dùng và Quản trị viên (Role-based Access Control - RBAC)

- **Dự án:** FinanceFlow (BTL App)
- **Ngày tạo:** 2026-11-02
- **Trạng thái:** Đã thống nhất thiết kế (Approved Design)
- **Tác giả:** Antigravity AI Assistant & Developer

---

### 1. Mục tiêu & Phạm vi (Objectives & Scope)

#### Mục tiêu
1. Thiết lập cơ chế Phân quyền (RBAC) vững chắc với 2 vai trò: **Admin** (Quản trị viên) và **User** (Người dùng thông thường).
2. Xây dựng không gian Quản trị (**Admin Portal**) riêng biệt trên ứng dụng di động cho Admin với trải nghiệm **Dual-Mode** linh hoạt (chuyển đổi nhanh 1 chạm giữa Chế độ Quản trị và Chế độ Người dùng).
3. Đảm bảo an toàn bảo mật đa tầng: Chặn truy cập trái phép bằng JWT RBAC Middleware trên Backend, kiểm tra trạng thái khóa tài khoản tức thì, đồng thời chống tự khóa hoặc tự tước quyền của chính Admin.
4. Hỗ trợ cơ chế **Đồng bộ Song song (Hybrid Sync)**: Vừa hoạt động với API server Node.js/MongoDB thật, vừa hoạt động đầy đủ trên bộ mô phỏng Offline Mock (`AsyncStorage`) giúp việc demo đồ án và chấm điểm luôn mượt mà.

#### Phạm vi (Scope)
- **Phía Backend (Node.js / Express / MongoDB):**
  - Cập nhật Model `User.js`: Bổ sung trường `role` (`'user' | 'admin'`) và `status` (`'active' | 'locked'`).
  - Cập nhật luồng tạo JWT Token: Đính kèm `role` vào token payload khi đăng ký, đăng nhập và đăng nhập mạng xã hội.
  - Xây dựng Middleware xác thực và phân quyền:
    - `middleware/auth.js`: Xác thực JWT và kiểm tra trạng thái khóa tài khoản trong Database theo thời gian thực (trả về 403 nếu tài khoản bị locked).
    - `middleware/rbac.js`: Kiểm tra vai trò quyền hạn `requireRole('admin')`.
  - Xây dựng cụm API Quản trị riêng biệt tại `/api/admin/*`:
    - Thống kê toàn hệ thống (User counts, giao dịch, hoạt động).
    - Quản lý danh sách người dùng, khóa/mở khóa tài khoản, phân quyền Admin/User.
    - Quản lý danh mục mặc định của hệ thống (`isDefault: true`).
  - Cập nhật Seed data: Khởi tạo tài khoản Admin mặc định (`admin@financeflow.vn` / `admin123`) và tài khoản User demo (`demo@financeflow.vn` / `123456`).
- **Phía Client (Expo / React Native / TypeScript):**
  - Mở rộng Interface `User` và `useAuthStore`: Quản lý `role`, `status` và `activeMode: 'admin' | 'user'`.
  - Cập nhật Role Guard tại `App.tsx`: Điều hướng tự động vào `AdminPortalScreen` khi Admin đăng nhập, hoặc vào `FinancialCenterScreen` khi ở chế độ User.
  - Xây dựng giao diện `AdminPortalScreen.tsx` với 3 Tab chức năng:
    - Tab 1: Tổng quan số liệu hệ thống (KPI Metrics).
    - Tab 2: Quản lý người dùng (Tìm kiếm, Lọc, Khóa/Mở khóa, Đổi vai trò).
    - Tab 3: Quản trị danh mục mẫu hệ thống (Thêm/Sửa/Xóa danh mục mặc định).
  - Tích hợp thanh chuyển đổi Dual-Mode Switcher: Cho phép Admin chuyển qua chế độ Người dùng và có nút quay trở lại Admin Portal bất kỳ lúc nào.
  - Đồng bộ `src/api/auth.ts` và tạo `src/api/admin.ts` với cơ chế Offline Fallback trên `AsyncStorage`.

---

### 2. Mô hình Dữ liệu (Data Model & Schema)

#### 2.1. Cập nhật Model `User` (`server/src/models/User.js`)
```javascript
const userSchema = new mongoose.Schema(
  {
    // ... các trường hiện có (email, passwordHash, username, phone, avatar, ...)
    role: {
      type: String,
      enum: {
        values: ['user', 'admin'],
        message: '{VALUE} không phải là vai trò hợp lệ',
      },
      default: 'user',
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'locked'],
        message: '{VALUE} không phải trạng thái hợp lệ',
      },
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);
```

#### 2.2. Dữ liệu Danh mục hệ thống (`server/src/models/Category.js`)
* Danh mục mặc định hệ thống: `userId: null, isDefault: true`. Chỉ Admin mới có quyền thêm/sửa/xóa thông qua `/api/admin/categories`.
* Danh mục cá nhân người dùng: `userId: ObjectId, isDefault: false`. Người dùng chỉ có quyền sửa/xóa danh mục của chính họ.

#### 2.3. Khởi tạo Seed Data (`server/src/seeds/demo.seed.js`)
* **Admin**:
  - Email: `admin@financeflow.vn`
  - Mật khẩu: `admin123`
  - Username: `Admin FinanceFlow`
  - Role: `admin`
  - Status: `active`
* **Demo User**:
  - Email: `demo@financeflow.vn`
  - Mật khẩu: `Demo@1234` (hoặc `123456`)
  - Username: `Nguyễn Demo`
  - Role: `user`
  - Status: `active`

---

### 3. Kiến trúc Bảo mật & Luồng Dữ liệu (Backend Security Architecture)

#### 3.1. Sơ đồ Luồng Xác thực & Phân quyền
```
                      [Client Request]
                             │
                  Header: Bearer <JWT Token>
                             │
                             ▼
              [Middleware 1: verifyAuth (auth.js)]
                             │
           ┌─────────────────┴─────────────────┐
           ▼                                   ▼
   Token không hợp lệ /                Token hợp lệ
   Hết hạn (Status 401)                        │
                                               ▼
                              Tra cứu trạng thái User trong DB
                                               │
                                 ┌─────────────┴─────────────┐
                                 ▼                           ▼
                         Status === 'locked'         Status === 'active'
                          (Status 403 Forbidden:              │
                         "Tài khoản bị khóa")                 ▼
                                                   Gắn req.user vào context
                                                              │
                                                              ▼
                                            [Middleware 2: requireRole('admin')]
                                                              │
                                                ┌─────────────┴─────────────┐
                                                ▼                           ▼
                                      req.user.role !== 'admin'    req.user.role === 'admin'
                                      (Status 403 Forbidden:                  │
                                      "Không đủ quyền hạn")                  ▼
                                                                     Chuyển tới Admin Controller
```

#### 3.2. Chi tiết Middleware
* `verifyAuth` (`server/src/middleware/auth.js`):
  1. Kiểm tra header `Authorization: Bearer <token>`.
  2. Giải mã JWT token.
  3. Lấy thông tin user từ DB:
     - Nếu user không tồn tại hoặc `user.status === 'locked'`: Trả về `403 Forbidden` kèm message: `"Tài khoản của bạn đã bị khóa bởi Quản trị viên."`.
  4. Gắn `req.user = { id: user._id.toString(), email: user.email, role: user.role, status: user.status }`.
* `requireRole(...roles)` (`server/src/middleware/rbac.js`):
  1. Kiểm tra `roles.includes(req.user.role)`.
  2. Nếu không thỏa mãn: Trả về `403 Forbidden` kèm message: `"Bạn không có quyền thực hiện thao tác này."`.

---

### 4. Danh sách API Quản trị (`/api/admin/*`)

Tất cả các endpoint dưới đây đều yêu cầu chuỗi middleware: `[verifyAuth, requireRole('admin')]`.

| HTTP Method | Endpoint | Tham số / Body | Chức năng |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/metrics` | Không | Lấy thống kê: Tổng user, user active/locked, tổng giao dịch, phân bố theo vai trò |
| `GET` | `/api/admin/users` | Query: `search`, `role`, `status`, `page`, `limit` | Lấy danh sách người dùng có phân trang và tìm kiếm |
| `PATCH` | `/api/admin/users/:id/status` | Body: `{ status: 'active' \| 'locked' }` | Khóa hoặc mở khóa tài khoản (chặn tự khóa chính mình) |
| `PATCH` | `/api/admin/users/:id/role` | Body: `{ role: 'user' \| 'admin' }` | Nâng/hạ quyền người dùng (chặn tự hạ quyền của chính mình) |
| `POST` | `/api/admin/categories` | Body: `{ name, type, icon, color }` | Thêm danh mục hệ thống mặc định (`isDefault: true`) |
| `PUT` | `/api/admin/categories/:id` | Body: `{ name, type, icon, color }` | Chỉnh sửa danh mục hệ thống mặc định |
| `DELETE` | `/api/admin/categories/:id` | Params: `id` | Xóa danh mục hệ thống mặc định |

---

### 5. Kiến trúc Client & Dual-Mode Routing (Frontend)

#### 5.1. Cập nhật Model & Store Client
* **`src/api/auth.ts`**:
  ```typescript
  export interface User {
    id: string;
    username: string;
    phone?: string;
    email: string;
    role: 'user' | 'admin';
    status?: 'active' | 'locked';
    authProvider?: 'local' | 'google' | 'apple' | 'facebook';
    avatar?: string | null;
  }
  ```
* **`src/store/useAuthStore.ts`**:
  ```typescript
  interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    activeMode: 'admin' | 'user';
    setUser: (user: User | null, token: string | null) => Promise<void>;
    setActiveMode: (mode: 'admin' | 'user') => void;
    updateProfile: (data: Partial<User>) => Promise<{ success: boolean; message: string }>;
    logout: () => Promise<void>;
    loadSession: () => Promise<void>;
  }
  ```
  - Khi đăng nhập thành công với `user.role === 'admin'`, tự động gán `activeMode: 'admin'`.

#### 5.2. Luồng Điều hướng & Role Guard tại `App.tsx`
* Khi `token` và `user` tồn tại:
  - Nếu `user.role === 'admin'` && `activeMode === 'admin'`: Render component `<AdminPortalScreen />`.
  - Nếu `user.role === 'user'` || (`user.role === 'admin'` && `activeMode === 'user'`): Render component `<FinancialCenterScreen />`.

#### 5.3. Trải nghiệm Dual-Mode Switcher UX
* **Trong Admin Portal**:
  - Tại Header có nút dạng Button/Badge: `[📱 Chuyển sang Chế độ Người dùng]`. Nhấn vào sẽ gọi `setActiveMode('user')`.
* **Trong FinancialCenterScreen (khi Admin ở User Mode)**:
  - Hiển thị thanh Banner nổi bật ở đầu trang hoặc nút trong tab Cá nhân: `[⚙️ Trở lại Trang Quản trị]`. Nhấn vào sẽ gọi `setActiveMode('admin')`.

---

### 6. Thiết kế Giao diện Admin Portal (`AdminPortalScreen.tsx`)

Giao diện được xây dựng chuẩn UX/UI với giao diện gọn gàng, chia 3 Tab chính:
1. **Tab 1: Thống kê hệ thống (Overview)**:
   - Thẻ thống kê: Tổng số người dùng, Tài khoản hoạt động, Tài khoản bị khóa, Tổng lượt giao dịch toàn hệ thống.
   - Thống kê tỷ lệ phân bổ tài khoản (Admin vs User, Local vs OAuth).
2. **Tab 2: Quản lý người dùng (User Management)**:
   - Ô tìm kiếm theo tên/email/sđt và bộ nút lọc nhanh: Tất cả, Hoạt động, Đã khóa, Admin.
   - Danh sách thẻ User: Hiển thị avatar, tên, email, ngày tạo, huy hiệu Role (`Admin` tím, `User` xanh), huy hiệu Status (`Active` xanh lá, `Locked` đỏ).
   - Nút hành động trực tiếp:
     - Nút "Khóa / Mở khóa" (với modal xác nhận).
     - Nút "Đổi vai trò" (User ⇄ Admin).
3. **Tab 3: Quản trị danh mục hệ thống (Category Management)**:
   - Bộ chọn phân loại: Chi tiêu (Expense) / Thu nhập (Income).
   - Danh sách các danh mục hệ thống hiện có kèm icon và màu sắc.
   - Nút "+ Thêm danh mục hệ thống": Mở modal nhập tên, chọn icon từ danh sách icon đẹp mắt (lucide-react-native) và chọn bảng màu.
   - Nút sửa và xóa cho từng danh mục mẫu.

---

### 7. Đồng bộ Offline Mock & Ràng buộc An toàn

#### 7.1. Đồng bộ Offline Mock trên AsyncStorage
* Seed dữ liệu người dùng trong `AsyncStorage` (`@financeflow_local_users`):
  - Admin: `admin@financeflow.vn` (mật khẩu `admin123`, `role: 'admin'`, `status: 'active'`).
  - Demo User: `demo@financeflow.vn` (mật khẩu `123456`, `role: 'user'`, `status: 'active'`).
  - Test Locked User: `locked@financeflow.vn` (mật khẩu `123456`, `role: 'user'`, `status: 'locked'`).
* Module `src/api/admin.ts` cài đặt cơ chế Offline Fallback: Khi mất kết nối backend hoặc fetch gặp lỗi mạng, tự động thao tác đọc/ghi trên `AsyncStorage`.

#### 7.2. Xử lý Lỗi & Buộc Đăng xuất (Force Logout)
* Khi gọi bất kỳ API nào mà nhận về HTTP Status `403` với message chứa `"khóa"`:
  - Client tự động kích hoạt `useAuthStore.getState().logout()`.
  - Hiển thị Alert: `"Tài khoản của bạn đã bị khóa bởi Quản trị viên. Vui lòng liên hệ hỗ trợ."`.
  - Đưa người dùng về màn hình Đăng nhập ngay lập tức.

#### 7.3. Ràng buộc An toàn Bất biến (Security Guards)
1. **Self-Lock Prevention**: Không cho phép Admin tự khóa tài khoản của chính mình (`targetId === req.user.id`).
2. **Self-Demotion Prevention**: Không cho phép Admin tự tước quyền Admin của chính mình (`targetId === req.user.id && newRole === 'user'`).
3. **Last Admin Protection**: Trước khi hạ quyền Admin của một user, kiểm tra tổng số admin đang hoạt động. Nếu chỉ còn duy nhất 1 Admin, từ chối yêu cầu và báo lỗi: `"Hệ thống phải có ít nhất 1 Quản trị viên đang hoạt động."`.

---

### 8. Kế hoạch Kiểm thử & Tiêu chí Chấp nhận (Acceptance Criteria)

1. **AC-RBAC-01 (Đăng nhập Admin & Điều hướng)**:
   - Đăng nhập bằng `admin` / `admin123` -> Điều hướng ngay vào `AdminPortalScreen`.
   - Hiển thị đầy đủ 3 Tab: Thống kê, Quản lý người dùng, Quản lý danh mục.
2. **AC-RBAC-02 (Dual-Mode Switcher)**:
   - Admin nhấn `[Chuyển sang Chế độ Người dùng]` -> Chuyển sang `FinancialCenterScreen` ngay lập tức.
   - Tại `FinancialCenterScreen`, Admin có banner/nút `[Trở lại Trang Quản trị]` -> Nhấn vào quay lại `AdminPortalScreen`.
3. **AC-RBAC-03 (Quản lý User & Khóa tài khoản)**:
   - Admin tìm kiếm và bấm "Khóa" một user -> Trạng thái user đổi thành `locked`.
   - Thử đăng nhập bằng tài khoản bị khóa -> Bị từ chối với thông báo tài khoản đã bị khóa.
   - Admin bấm "Mở khóa" -> Trạng thái đổi lại `active` và đăng nhập bình thường.
4. **AC-RBAC-04 (Bảo vệ an toàn Admin)**:
   - Admin không thể tự bấm khóa tài khoản của chính mình (nút bị vô hiệu hoặc báo lỗi).
   - Admin không thể tự hạ quyền của chính mình.
5. **AC-RBAC-05 (Bảo vệ API Backend)**:
   - Dùng token của User thông thường gọi vào `/api/admin/metrics` hoặc `/api/admin/users` -> Nhận lỗi HTTP 403 Forbidden.
6. **AC-RBAC-06 (Hoạt động hoàn hảo ở cả Online và Offline Mock)**:
   - Bật server Node.js: Lưu dữ liệu thật vào MongoDB.
   - Tắt server Node.js: Ứng dụng tự động chuyển sang Offline Mock trên AsyncStorage, tất cả chức năng quản trị, chuyển đổi chế độ vẫn mượt mà không crash.
