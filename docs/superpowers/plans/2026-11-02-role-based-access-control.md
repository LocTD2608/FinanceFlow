# Role-based Access Control (RBAC) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng cơ chế Phân quyền (RBAC) cho Admin và User bao gồm bảo mật đa tầng trên Backend Express/MongoDB và không gian Quản trị Admin Portal Dual-Mode trên Mobile Expo React Native.

**Architecture:** Bổ sung trường `role` và `status` vào User Model; JWT token payload mang `role`; xây dựng middleware xác thực và kiểm tra trạng thái khóa tài khoản trong DB theo thời gian thực kết hợp middleware `requireRole('admin')`; phát triển cụm API `/api/admin/*` cho metrics, quản lý user, danh mục hệ thống; phía mobile cung cấp `AdminPortalScreen` 3 tab với bộ chuyển đổi linh hoạt Dual-Mode và đồng bộ 100% dữ liệu Offline Mock trên `AsyncStorage`.

**Tech Stack:** Node.js, Express, MongoDB (Mongoose), JWT, Jest, Supertest, Expo React Native, TypeScript, Zustand, AsyncStorage, Lucide React Native.

**Spec:** `docs/superpowers/specs/2026-11-02-role-based-access-control-design.md`

## Global Constraints
- `role` chỉ nhận giá trị: `'user'` hoặc `'admin'` (mặc định `'user'`).
- `status` chỉ nhận giá trị: `'active'` hoặc `'locked'` (mặc định `'active'`).
- Admin không thể tự khóa tài khoản của chính mình (`targetUserId !== currentUserId`).
- Admin không thể tự hạ quyền của chính mình (`targetUserId !== currentUserId` khi role đổi thành `'user'`).
- Hệ thống luôn phải có ít nhất 1 tài khoản Admin đang hoạt động (`status: 'active'`).
- Người dùng bị khóa (`status === 'locked'`) phải bị từ chối với mã 403 Forbidden và client tự động thực hiện đăng xuất xóa session.
- Toàn bộ cơ chế phân quyền, quản trị và chuyển đổi Dual-Mode phải hoạt động đồng bộ cả khi kết nối Server thật lẫn khi chạy chế độ Offline Mock (`AsyncStorage`).

## Review Focus
1. User bị locked khi đang giữ token cũ vẫn phải bị chặn ngay lập tức tại middleware `verifyAuth` (không đợi token hết hạn 7 ngày).
2. Thao tác hạ quyền hoặc khóa tài khoản của chính Admin đang gửi request phải bị chặn và trả về lỗi 400 Bad Request.
3. Thao tác hạ quyền Admin cuối cùng trong hệ thống phải bị chặn và trả về lỗi 400 Bad Request.
4. User thông thường (`role: 'user'`) gọi bất kỳ route nào dưới `/api/admin/*` phải nhận mã 403 Forbidden.
5. Khi không có kết nối server Backend, các tính năng của `adminApi` (đổi role, toggle status, thêm danh mục) phải thực thi bình thường trên `AsyncStorage`.

---

### Task 1: Backend Data Model & JWT RBAC Payload

**Files:**
- Modify: `server/src/models/User.js`
- Modify: `server/src/controllers/auth.controller.js`
- Test: `server/tests/auth.role.test.js`

**Interfaces:**
- Consumes: Mongoose User schema, `jsonwebtoken`, `bcryptjs`.
- Produces: `User` model với `role` (`'user' | 'admin'`) và `status` (`'active' | 'locked'`); JWT token chứa `{ id, email, role }`; API `register`, `login`, `socialLogin` trả về `user: { id, email, role, status, ... }`.

- [ ] **Step 1: Write the failing test for User model role/status and auth controller JWT payload**

Tạo file `server/tests/auth.role.test.js`:
```javascript
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../src/models/User');
const authController = require('../src/controllers/auth.controller');

describe('User Model & Auth Controller Role/Status', () => {
  it('User model should have role and status defaults', () => {
    const user = new User({ email: 'test@role.vn', passwordHash: 'hash' });
    expect(user.role).toBe('user');
    expect(user.status).toBe('active');
  });

  it('User model should reject invalid role or status', async () => {
    const user = new User({ email: 'invalid@role.vn', passwordHash: 'hash', role: 'superman', status: 'banned' });
    const err = user.validateSync();
    expect(err.errors.role).toBeDefined();
    expect(err.errors.status).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow/server test server/tests/auth.role.test.js`
Expected: FAIL do `user.role` và `user.status` chưa được khai báo trong schema.

- [ ] **Step 3: Implement role & status in User.js and auth.controller.js**

- Trong `server/src/models/User.js`:
  Thêm `role` (`'user' | 'admin'`, default `'user'`) và `status` (`'active' | 'locked'`, default `'active'`).
- Trong `server/src/controllers/auth.controller.js`:
  - `register`: `jwt.sign({ id: newUser._id, email: newUser.email, role: newUser.role }, JWT_SECRET, ...)` và trả về `user.role`, `user.status`.
  - `login`: `jwt.sign({ id: user._id, email: user.email, role: user.role }, JWT_SECRET, ...)` và trả về `user.role`, `user.status`. Kiểm tra nếu `user.status === 'locked'` thì từ chối ngay với 403: `'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.'`.
  - `socialLogin`: Tương tự, gán role mặc định và đính kèm `role` vào token.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow/server test server/tests/auth.role.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add server/src/models/User.js server/src/controllers/auth.controller.js server/tests/auth.role.test.js
git -C FinanceFlow commit -m "feat(backend): add role and status fields to User model and JWT payload"
```

---

### Task 2: Backend Security Middleware (verifyAuth & requireRole)

**Files:**
- Modify: `server/src/middleware/auth.js`
- Create: `server/src/middleware/rbac.js`
- Test: `server/tests/rbac.middleware.test.js`

**Interfaces:**
- Consumes: `jwt.verify`, `User.findById`.
- Produces:
  - `auth` middleware: gắn `req.user = { id, email, role, status }`, trả 403 nếu `user.status === 'locked'`.
  - `rbac.requireRole(...roles)`: middleware kiểm tra `roles.includes(req.user.role)`, trả 403 nếu không đủ quyền.

- [ ] **Step 1: Write the failing test for auth middleware and rbac middleware**

Tạo file `server/tests/rbac.middleware.test.js`:
```javascript
const jwt = require('jsonwebtoken');
const auth = require('../src/middleware/auth');
const { requireRole } = require('../src/middleware/rbac');
const User = require('../src/models/User');

jest.mock('../src/models/User');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('RBAC Middleware', () => {
  it('requireRole should call next when role matches', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('requireRole should return 403 when role does not match', () => {
    const req = { user: { role: 'user' } };
    const res = mockRes();
    const next = jest.fn();
    requireRole('admin')(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('auth middleware should reject locked user with 403', async () => {
    const SECRET = process.env.JWT_SECRET || 'financeflow_dev_jwt_secret_2026';
    const token = jwt.sign({ id: 'u_locked', email: 'locked@b.c', role: 'user' }, SECRET);
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: 'u_locked', email: 'locked@b.c', role: 'user', status: 'locked' })
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    const next = jest.fn();
    await auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow/server test server/tests/rbac.middleware.test.js`
Expected: FAIL do `../src/middleware/rbac` chưa tồn tại và `auth.js` chưa kiểm tra trạng thái `locked`.

- [ ] **Step 3: Implement auth.js (with locked check) & rbac.js**

- Tạo `server/src/middleware/rbac.js`:
  ```javascript
  exports.requireRole = (...roles) => {
    return (req, res, next) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền thực hiện chức năng này.',
        });
      }
      next();
    };
  };
  ```
- Cập nhật `server/src/middleware/auth.js`:
  - Giải mã token JWT.
  - Tìm user trong DB theo `decoded.id` (nếu có DB kết nối) kiểm tra `status === 'locked'`.
  - Gắn `req.user = { id: decoded.id, email: decoded.email, role: decoded.role || 'user', status: user ? user.status : 'active' }`.
  - Nếu `user && user.status === 'locked'`, trả về `res.status(403).json({ success: false, message: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.' })`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow/server test server/tests/rbac.middleware.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add server/src/middleware/auth.js server/src/middleware/rbac.js server/tests/rbac.middleware.test.js
git -C FinanceFlow commit -m "feat(backend): implement auth real-time locked check and rbac requireRole middleware"
```

---

### Task 3: Backend Admin Controller & Routes (`/api/admin/*`)

**Files:**
- Create: `server/src/controllers/admin.controller.js`
- Create: `server/src/routes/admin.routes.js`
- Modify: `server/src/index.js`
- Test: `server/tests/admin.routes.test.js`

**Interfaces:**
- Consumes: `User`, `Category`, `Transaction` models, `verifyAuth`, `requireRole('admin')`.
- Produces: REST endpoints `/api/admin/metrics`, `/api/admin/users`, `/api/admin/users/:id/status`, `/api/admin/users/:id/role`, `/api/admin/categories` (POST, PUT, DELETE).

- [ ] **Step 1: Write the failing test for Admin endpoints**

Tạo file `server/tests/admin.routes.test.js`:
```javascript
const request = require('supertest');
const express = require('express');
const adminRoutes = require('../src/routes/admin.routes');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
// Mock verifyAuth to simulate admin vs normal user
app.use((req, res, next) => {
  const role = req.headers['x-mock-role'] || 'user';
  const id = req.headers['x-mock-id'] || 'admin_1';
  req.user = { id, email: 'admin@test.com', role, status: 'active' };
  next();
});
app.use('/api/admin', adminRoutes);

describe('Admin Routes Protection', () => {
  it('GET /api/admin/metrics should reject normal user with 403', async () => {
    const res = await request(app).get('/api/admin/metrics').set('x-mock-role', 'user');
    expect(res.status).toBe(403);
  });

  it('GET /api/admin/metrics should allow admin', async () => {
    const res = await request(app).get('/api/admin/metrics').set('x-mock-role', 'admin');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('PATCH /api/admin/users/:id/status should forbid self-lock', async () => {
    const res = await request(app)
      .patch('/api/admin/users/admin_1/status')
      .set('x-mock-role', 'admin')
      .set('x-mock-id', 'admin_1')
      .send({ status: 'locked' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/chính mình/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow/server test server/tests/admin.routes.test.js`
Expected: FAIL do route và controller chưa tồn tại.

- [ ] **Step 3: Implement admin.controller.js and admin.routes.js**

- Tạo `server/src/controllers/admin.controller.js`:
  - `getMetrics`: Đếm tổng user, user theo role & status, tổng giao dịch và thống kê cơ bản.
  - `getUsers`: Phân trang, tìm kiếm `search` theo email/username/phone, lọc `role`, `status`.
  - `updateUserStatus`:
    - Nếu `req.params.id === req.user.id`: Chặn tự khóa chính mình (400 Bad Request: `'Không thể tự khóa tài khoản của chính mình.'`).
    - Cập nhật `status`.
  - `updateUserRole`:
    - Nếu `req.params.id === req.user.id && req.body.role === 'user'`: Chặn tự hạ quyền chính mình (400 Bad Request: `'Không thể tự tước quyền Quản trị của chính mình.'`).
    - Nếu hạ quyền Admin xuống User: Đếm số lượng Admin đang active trong hệ thống. Nếu chỉ còn 1 Admin, từ chối (400 Bad Request: `'Hệ thống phải duy trì ít nhất 1 Quản trị viên đang hoạt động.'`).
    - Cập nhật `role`.
  - `createCategory`: Tạo danh mục hệ thống mặc định (`userId: null, isDefault: true`).
  - `updateCategory`: Sửa danh mục hệ thống.
  - `deleteCategory`: Xóa danh mục hệ thống.
- Tạo `server/src/routes/admin.routes.js`: Gắn `[auth, requireRole('admin')]` cho tất cả các route.
- Trong `server/src/index.js`: Gắn `app.use('/api/admin', require('./routes/admin.routes'));`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow/server test server/tests/admin.routes.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add server/src/controllers/admin.controller.js server/src/routes/admin.routes.js server/src/index.js server/tests/admin.routes.test.js
git -C FinanceFlow commit -m "feat(backend): implement admin controller and routes with self-protection guards"
```

---

### Task 4: Seed Data & Admin Initial Configuration

**Files:**
- Modify: `server/src/seeds/demo.seed.js`
- Modify: `server/src/seeds/index.js`
- Test: `server/tests/seed.rbac.test.js`

**Interfaces:**
- Consumes: `User` model, `bcryptjs`.
- Produces: Tài khoản Admin mặc định (`admin@financeflow.vn` / `admin123`, `role: 'admin'`, `status: 'active'`) và tài khoản User demo (`demo@financeflow.vn`, `role: 'user'`, `status: 'active'`).

- [ ] **Step 1: Write the failing test for seed accounts**

Tạo `server/tests/seed.rbac.test.js`:
```javascript
const { getDemoData } = require('../src/seeds/demo.seed');

describe('Seed Data RBAC', () => {
  it('demo seed should return admin and demo user with correct roles', async () => {
    const data = await getDemoData({});
    expect(data.admin).toBeDefined();
    expect(data.admin.role).toBe('admin');
    expect(data.admin.status).toBe('active');
    expect(data.user.role).toBe('user');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow/server test server/tests/seed.rbac.test.js`
Expected: FAIL do seed chưa có đối tượng `admin`.

- [ ] **Step 3: Update demo.seed.js & index.js to seed Admin**

- Trong `server/src/seeds/demo.seed.js`:
  Thêm cấu hình tài khoản `admin`:
  ```javascript
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const admin = {
    email: 'admin@financeflow.vn',
    passwordHash: adminPasswordHash,
    username: 'Admin FinanceFlow',
    nickname: 'Admin',
    phone: '0988888888',
    role: 'admin',
    status: 'active',
  };
  ```
- Trong `server/src/seeds/index.js`: Thực hiện tạo tài khoản `admin` nếu chưa tồn tại.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow/server test server/tests/seed.rbac.test.js`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add server/src/seeds/demo.seed.js server/src/seeds/index.js server/tests/seed.rbac.test.js
git -C FinanceFlow commit -m "feat(backend): add default admin account to database seeds"
```

---

### Task 5: Frontend State Management & API Integration with Offline Mock

**Files:**
- Modify: `src/api/auth.ts`
- Create: `src/api/admin.ts`
- Modify: `src/store/useAuthStore.ts`
- Test: `tests/unit/auth.store.test.ts`

**Interfaces:**
- Consumes: `@react-native-async-storage/async-storage`, `src/api/config.ts`.
- Produces:
  - `User` interface có `role: 'user' | 'admin'` và `status: 'active' | 'locked'`.
  - `adminApi`: gồm `getMetrics`, `getUsers`, `updateUserStatus`, `updateUserRole`, `createCategory`, `updateCategory`, `deleteCategory` với offline fallback trên AsyncStorage.
  - `useAuthStore`: có state `activeMode: 'admin' | 'user'`, action `setActiveMode(mode)`.

- [ ] **Step 1: Write the failing test for useAuthStore dual mode and role handling**

Tạo `tests/unit/auth.store.test.ts`:
```typescript
import { useAuthStore } from '../../src/store/useAuthStore';

describe('useAuthStore RBAC and Dual-Mode', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, activeMode: 'user' });
  });

  it('sets activeMode to admin when admin logs in', async () => {
    const adminUser = { id: 'admin1', username: 'Admin', email: 'admin@ff.vn', role: 'admin' as const, status: 'active' as const };
    await useAuthStore.getState().setUser(adminUser, 'token_admin');
    expect(useAuthStore.getState().activeMode).toBe('admin');
  });

  it('sets activeMode to user when normal user logs in', async () => {
    const normalUser = { id: 'u1', username: 'User 1', email: 'u1@ff.vn', role: 'user' as const, status: 'active' as const };
    await useAuthStore.getState().setUser(normalUser, 'token_user');
    expect(useAuthStore.getState().activeMode).toBe('user');
  });

  it('allows admin to switch mode to user and back', () => {
    useAuthStore.getState().setActiveMode('user');
    expect(useAuthStore.getState().activeMode).toBe('user');
    useAuthStore.getState().setActiveMode('admin');
    expect(useAuthStore.getState().activeMode).toBe('admin');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix FinanceFlow test tests/unit/auth.store.test.ts`
Expected: FAIL do `activeMode` và `setActiveMode` chưa có trong store.

- [ ] **Step 3: Implement auth.ts, admin.ts, and useAuthStore.ts**

- Trong `src/api/auth.ts`:
  - Cập nhật interface `User`: Thêm `role: 'user' | 'admin'`, `status?: 'active' | 'locked'`.
  - Trong offline mock fallback của `login`: gán `role: 'admin'`, `status: 'active'` cho tài khoản admin (`admin@financeflow.vn`, `admin`); kiểm tra nếu `user.status === 'locked'` thì trả về `{ success: false, message: 'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.' }`.
  - Thêm tài khoản locked mẫu (`locked_user@example.com` / `123456`, `role: 'user'`, `status: 'locked'`) vào mock users.
- Tạo `src/api/admin.ts`:
  - Cung cấp `adminApi` gọi tới backend `/api/admin/*`.
  - Nếu fetch thất bại (Offline fallback): Đọc và ghi trực tiếp vào `AsyncStorage` (`@financeflow_local_users`, `@financeflow_local_categories`), bảo đảm mọi tác vụ admin đều chạy mượt.
- Trong `src/store/useAuthStore.ts`:
  - Thêm `activeMode: 'admin' | 'user'`.
  - Thêm `setActiveMode: (mode) => set({ activeMode: mode })`.
  - Trong `setUser(user, token)`: tự động đặt `activeMode: user?.role === 'admin' ? 'admin' : 'user'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix FinanceFlow test tests/unit/auth.store.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add src/api/auth.ts src/api/admin.ts src/store/useAuthStore.ts tests/unit/auth.store.test.ts
git -C FinanceFlow commit -m "feat(frontend): integrate rbac types, admin api with offline mock, and dual-mode auth store"
```

---

### Task 6: Frontend Role Guard, Dual-Mode Switcher & Admin Portal Screen

**Files:**
- Create: `src/screens/admin/AdminPortalScreen.tsx`
- Modify: `App.tsx`
- Modify: `src/screens/dashboard/FinancialCenterScreen.tsx`
- Test: `tests/unit/admin.guard.test.ts`

**Interfaces:**
- Consumes: `useAuthStore`, `adminApi`, `lucide-react-native`.
- Produces:
  - Giao diện `AdminPortalScreen` đầy đủ 3 Tab (Overview Metrics, User Management, Category Management) và nút chuyển nhanh Chế độ Người dùng.
  - Role Guard trong `App.tsx` điều hướng theo `user.role` và `activeMode`.
  - Thanh Banner / Nút "Về Trang Quản trị" trong `FinancialCenterScreen` khi Admin đang ở User Mode.

- [ ] **Step 1: Write test for Role Guard navigation logic**

Tạo `tests/unit/admin.guard.test.ts`:
```typescript
describe('Role Guard Navigation Logic', () => {
  const resolveScreen = (user: any, activeMode: string) => {
    if (!user) return 'welcome';
    if (user.role === 'admin' && activeMode === 'admin') return 'admin_portal';
    return 'home';
  };

  it('routes admin in admin mode to admin_portal', () => {
    expect(resolveScreen({ role: 'admin' }, 'admin')).toBe('admin_portal');
  });

  it('routes admin in user mode to home', () => {
    expect(resolveScreen({ role: 'admin' }, 'user')).toBe('home');
  });

  it('routes normal user to home regardless of mode', () => {
    expect(resolveScreen({ role: 'user' }, 'admin')).toBe('home');
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm --prefix FinanceFlow test tests/unit/admin.guard.test.ts`
Expected: PASS.

- [ ] **Step 3: Implement AdminPortalScreen.tsx, App.tsx, and FinancialCenterScreen.tsx**

- Tạo `src/screens/admin/AdminPortalScreen.tsx`:
  - **Header**: Tiêu đề "FinanceFlow Admin Portal", Badge vai trò "Quản trị viên", Nút `[📱 Chế độ User]` (gọi `setActiveMode('user')`), Nút Đăng xuất.
  - **Tabs Navigator**:
    - **Tab 1 (Thống kê)**: 4 thẻ KPI (Tổng User, Active, Locked, Tổng giao dịch), Tỷ lệ đăng ký theo authProvider.
    - **Tab 2 (Người dùng)**: Tìm kiếm theo text, nút lọc trạng thái/role, danh sách Card User kèm avatar, email, role badge, status badge. Nút Toggle Khóa/Mở khóa (chặn tự khóa chính mình), nút Đổi vai trò (User ⇄ Admin, chặn tự hạ quyền chính mình).
    - **Tab 3 (Danh mục hệ thống)**: Xem danh sách danh mục mặc định (`isDefault: true`), nút "+ Thêm danh mục", modal tạo/sửa với chọn icon Lucide và màu sắc, nút xóa danh mục.
- Cập nhật `App.tsx`:
  - Thêm điều kiện: Nếu `token && user`:
    - Nếu `user.role === 'admin' && activeMode === 'admin'`: Render `<AdminPortalScreen onLogout={() => setCurrentScreen('welcome')} />`.
    - Ngược lại render `<FinancialCenterScreen onLogout={() => setCurrentScreen('welcome')} />`.
  - Lắng nghe sự kiện nếu phát hiện `user.status === 'locked'`: Hiển thị cảnh báo và tự động logout đưa về màn hình Đăng nhập.
- Cập nhật `src/screens/dashboard/FinancialCenterScreen.tsx`:
  - Kiểm tra nếu `user?.role === 'admin'`: Hiển thị thanh Banner nổi bật ở đầu trang: *"🛡️ Bạn đang ở Chế độ Người dùng (Tài khoản Quản trị)"* kèm nút `[⚙️ Về Trang Quản trị]`. Nhấn vào sẽ gọi `setActiveMode('admin')`.

- [ ] **Step 4: Run type check and full test suite**

Run: `npm --prefix FinanceFlow run type-check && npm --prefix FinanceFlow test`
Expected: PASS (không có lỗi biên dịch TypeScript hay Jest).

- [ ] **Step 5: Commit changes**

```bash
git -C FinanceFlow add src/screens/admin/AdminPortalScreen.tsx App.tsx src/screens/dashboard/FinancialCenterScreen.tsx tests/unit/admin.guard.test.ts
git -C FinanceFlow commit -m "feat(frontend): implement admin portal screen, dual-mode switcher and role guard"
```
