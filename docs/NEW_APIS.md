# API bổ sung (nhánh `feat/wallet-topup-cron`)

Tất cả endpoint yêu cầu `Authorization: Bearer <token>`.

## Ví
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/wallets` | Tạo ví. Ví thường không được âm; `credit_card` được âm. Số dư đầu > 0 tạo giao dịch thu "Khác (Thu)". |
| GET | `/api/wallets/:id` | Chi tiết ví |
| PATCH | `/api/wallets/:id` | Sửa ví. Sửa `balance` trực tiếp **không tạo giao dịch** (lưu `lastManualAdjustment`) |
| DELETE | `/api/wallets/:id` | Xóa mềm, không xóa ví cuối cùng |
| POST | `/api/wallets/:id/topup` | Nạp tiền `{amount, categoryId?, note?, idempotencyKey?}`; mặc định danh mục "Lương", tối đa 100.000.000 |

Danh mục nạp tiền: Lương (mặc định), Thưởng, Công việc phụ, Vay mượn, Đầu tư, Kinh doanh, Khác. Danh mục "Khác" bắt buộc ghi chú (≤ 50 ký tự).

## Giao dịch
`POST/PUT/DELETE /api/transactions` trả lỗi 400 khi ví thường không đủ tiền:
```json
{ "success": false, "code": "INSUFFICIENT_BALANCE", "currentBalance": 50000, "requiredAmount": 100000, "shortfall": 50000 }
```

## Thanh toán QR + OTP (Gmail)
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/payments/intent` | `{walletId, categoryId, amount, note}` → gửi OTP 6 số tới email user. Trả `{intentId, expiresAt, email(đã che)}`. OTP **không** nằm trong response |
| POST | `/api/payments/intent/:id/resend` | Gửi lại (cách ≥ 60s, tối đa 3 lần gửi/intent) |
| POST | `/api/payments/intent/:id/confirm` | `{otp}` → trừ tiền + ghi giao dịch chi. OTP hết hạn sau 3 phút, tối đa 5 lần nhập sai |

Lỗi `code`: `INSUFFICIENT_BALANCE`, `OTP_INVALID`, `OTP_EXPIRED`, `TOO_MANY_ATTEMPTS`.

Cấu hình `.env`: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (Gmail App Password), `MAIL_FROM`.

## Tài sản ròng
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/networth/trend?months=6` | Xu hướng N tháng (tối đa 36) |
| POST | `/api/networth/snapshot` | Chụp ngay tháng hiện tại |

Cron: 23:30 (giờ VN) ngày cuối tháng; khi server khởi động sẽ bù snapshot tháng trước nếu thiếu.
`netWorth = Σ max(balance,0) − Σ |balance| của credit_card âm`; bỏ qua ví đã lưu trữ / `isExcludedFromNetWorth`.

## Nhắc hóa đơn + Push
| Method | Path | Mô tả |
|---|---|---|
| GET/POST | `/api/bill-reminders` | Danh sách (`?status=pending|paid`) / tạo |
| PATCH/DELETE | `/api/bill-reminders/:id` | Sửa / xóa |
| POST | `/api/bill-reminders/:id/pay` | `{walletId, categoryId?}` → giao dịch chi, đánh dấu đã trả, tạo kỳ kế tiếp nếu có lặp |
| POST/DELETE | `/api/auth/push-token` | Đăng ký / hủy Expo push token `{token, platform}` |

Cron 08:00 (giờ VN) gửi push ở các mốc: còn 3 ngày, 1 ngày, đến hạn, quá hạn (mỗi mốc 1 lần).
Push chỉ hoạt động trên thiết bị thật / dev build.

## Migration
```
cd server && npm run migrate:rename-categories
```
Đổi tên `Tiền phụ thu` → `Công việc phụ`, `Cho vay thu hồi` → `Vay mượn` (chạy lại an toàn).
