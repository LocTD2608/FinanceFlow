# FinanceFlow - Mobile App Quản Lý Tài Chính & Dòng Tiền

Ứng dụng quản lý tài chính cá nhân, ngân sách và kiểm soát dòng tiền hàng tháng xây dựng bằng **React Native (Expo)** và **TypeScript**.

## 🚀 Tính năng chính
- **Dashboard tài chính**: Theo dõi dòng tiền thực tế (Thu nhập, Chi tiêu, Số dư khả dụng).
- **Hạn mức chi tiêu mỗi ngày (Daily Safe-to-Spend Limit)**: Tính toán tự động số tiền được tiêu tối đa mỗi ngày.
- **Lập & Quản lý Ngân sách**: Thiết lập hạn mức từng danh mục và cảnh báo thông minh (50%, 80%, 100%).
- **Quản lý Đa tài khoản & Tài sản ròng**: Quản lý ví tiền mặt, ngân hàng, thẻ tín dụng, theo dõi Tổng tài sản vs Nợ.
- **Báo cáo & Phân tích**: Biểu đồ trực quan danh mục chi tiêu, bảng xếp hạng các khoản chi ngốn tiền nhất tháng.

## 🛠️ Công nghệ sử dụng
- **Framework**: React Native with Expo SDK 52
- **Language**: TypeScript
- **Navigation**: React Navigation v7
- **State Management**: Zustand
- **Storage**: AsyncStorage
- **Testing**: Jest & React Native Testing Library
- **CI/CD**: GitHub Actions

## 📦 Cài đặt & Chạy ứng dụng

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Chạy trên máy tính (Web - Khuyên dùng)
```bash
npm run web
```
Truy cập `http://localhost:8081` trên trình duyệt và bật chế độ Mobile (F12 -> Ctrl+Shift+M).

### 3. Chạy trên điện thoại
```bash
npm start
```
Mở app **Expo Go** trên điện thoại và quét mã QR hiển thị trong terminal.

### 4. Kiểm tra code & Test
```bash
npm run type-check   # Kiểm tra lỗi TypeScript
npm test             # Chạy bộ unit tests
```
