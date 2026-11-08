# KAN-34 — Hoàn thiện sau kiểm tra kết nối thật

Tiếp tục thiết kế đã duyệt `../specs/2026-11-07-kan-34-chatbot-backend-design.md`, không mở rộng sang màn hình chat. Thực hiện trực tiếp bằng executing-plans, TDD và ponytail.

- [x] Sửa cấu hình mẫu trùng biến; dùng model đã kiểm tra thật `gemini-3.1-flash-lite`. Phân biệt lỗi model không còn khả dụng bằng test transport rồi sửa xử lý 404.
- [x] Kiểm thử HTTP qua JWT thật, router, service, tools và MongoDB replica set tạm cho hướng dẫn, báo cáo/gợi ý, nháp thu/chi/ngân sách, xác nhận, retry và quyền sở hữu. Chỉ giả lập phản hồi Gemini; không dùng dữ liệu tài chính thật.
- [x] Thêm `npm run chat:check` kiểm tra cấu hình, ping và transaction đọc MongoDB, Gemini function calling. Lệnh chỉ đọc database, không ghi giao dịch, không in khóa hoặc URI; không tự chạy trong test/CI. Cập nhật tài liệu cách chạy.
- [x] Chạy kiểm tra live, toàn bộ test backend/frontend, type-check và diff; review, commit/push `feat(chatbot): KAN-34 Tich hop logic backend cho chatbot`.

Hiện trạng: phần triển khai chính đã có trong bfa7cd2/058e39f. Nhánh hiện còn các commit KAN-33 và thay đổi chưa commit ở `server/tests/transaction.controller.test.js`; không chỉnh hoặc stage thay đổi đó. `.env` chỉ lưu local và được Git bỏ qua.

Kết quả 2026-11-08: 35 suites / 341 backend tests và 9 suites / 37 frontend tests đạt; test HTTP sau chỉnh clock đạt 2/2. Live chat:check đạt MongoDB ping + transaction đọc và Gemini app_guide + câu trả lời cuối. Review không còn lỗi production; đã sửa test quota chạy ngang phút. Type-check toàn dự án lần đầu báo lỗi AppNotification ở các file KAN-33 đang sửa song song; không sửa/stage các file đó. Chỉ stage các file KAN-34 nêu trong kế hoạch này.
