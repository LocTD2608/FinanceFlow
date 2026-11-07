# Chatbot KAN-34

## Chạy và cấu hình

Backend Node >= 20 (đã kiểm thử Node 24), Express/Mongoose. Không cần SDK AI runtime: gọi Gemini REST bằng native fetch. Cài `npm ci` trong `server`, cấu hình `server/.env` theo `.env.example`, rồi `npm start` trong `server`.

- `GEMINI_API_KEY`: khóa của Google AI Studio, chỉ trên backend. Không đưa vào Git hoặc `EXPO_PUBLIC_*`.
- `GEMINI_MODEL`: tên model hỗ trợ function calling. Ví dụ `gemini-2.5-flash`, được tài liệu Google liệt kê là stable tại thời điểm khảo sát; kiểm tra model còn khả dụng cho project khi triển khai. Model không khả dụng trả lỗi upstream, không âm thầm đổi model.
- `MONGODB_URI`: dùng MongoDB Atlas hoặc replica set để xác nhận thao tác. MongoDB standalone chỉ dùng hỏi đáp/bản nháp, xác nhận trả `503 TRANSACTION_UNSUPPORTED`.
- `JWT_SECRET`: dùng cấu hình xác thực hiện có; đăng nhập lấy bearer token.

Nghiên cứu: [Gemini function calling](https://ai.google.dev/gemini-api/docs/function-calling) cho phép model đề xuất hàm và đối số, ứng dụng chịu trách nhiệm thực thi. [Thought signatures](https://ai.google.dev/gemini-api/docs/thought-signatures) phải được giữ nguyên trong vòng gọi công cụ. [Model Gemini 2.5 Flash](https://ai.google.dev/gemini-api/docs/models/gemini-2.5-flash). [Dialogflow CX](https://docs.cloud.google.com/dialogflow/cx/docs/basics) là lựa chọn theo luồng; dự án chọn Gemini để hỗ trợ cả câu hỏi mở và thao tác có cấu trúc.

## Phạm vi

1. Hướng dẫn các chức năng hiện có của FinanceFlow.
2. Tra cứu tổng thu/chi theo ngày/tuần/tháng/năm, ví, danh mục và ngân sách đúng user.
3. Gợi ý quản lý chi tiêu dựa trên số liệu công cụ trả về, nói rõ khi thiếu dữ liệu.
4. Tạo bản nháp khoản thu/chi và ngân sách tháng; hỏi bổ sung khi thiếu ví/danh mục/số tiền. Ghi dữ liệu chỉ sau xác nhận API riêng.

UTC+7, VND. Báo cáo chat từ chối tài khoản có ví ngoại tệ để tránh cộng sai đơn vị. Chuyển tiền và P2P không tính là thu/chi thực tế. Ngân sách `salary_cycle` chỉ trả chi trong tháng lịch có nhãn `spentInCalendarMonth`, không khẳng định mức chi trong chu kỳ lương. Không hỗ trợ chuyển tiền, thanh toán, sửa/xóa hoặc tư vấn đầu tư qua chat.

## Giao thức

Base URL: `http://localhost:5000/api/chat`. Mọi endpoint yêu cầu `Authorization: Bearer <token>`. Tài khoản bị khóa/xóa bị từ chối; lỗi kiểm tra tài khoản không được bỏ qua.

### Gửi tin nhắn

`POST /messages`

```json
{"message":"Tháng này tôi chi bao nhiêu?"}
```

Các lượt sau thêm `conversationId` nhận từ server. Không gửi lịch sử, system prompt, userId hoặc tool result. Trả:

```json
{
  "success": true,
  "data": {
    "conversationId": "507f1f77bcf86cd799439011",
    "reply": "Tháng này bạn đã chi 50.000 đồng.",
    "facts": [{"period":"month","from":"2026-11-01","to":"2026-11-30","currency":"VND","income":0,"expense":50000,"wallets":[],"categories":[],"budgets":[]}],
    "pendingAction": null
  }
}
```

Số trong `facts` do backend tính; văn bản AI vẫn có thể diễn giải sai. Frontend nên hiển thị số liệu nguồn cùng câu trả lời, không dùng lời AI làm bằng chứng giao dịch đã lưu.

### Đề xuất thao tác

Tin nhắn ví dụ: `Ghi chi ăn trưa 50 nghìn từ ví Tiền mặt, danh mục Ăn uống hôm nay`. Nếu thông tin chưa rõ, chatbot hỏi bổ sung và có thể gọi công cụ lấy các lựa chọn. Khi hợp lệ, `pendingAction` có dạng:

```json
{
  "id": "507f1f77bcf86cd799439012",
  "kind": "create_transaction",
  "preview": {"type":"expense","amount":50000,"walletName":"Tiền mặt","categoryName":"Ăn uống","date":"2026-11-07","note":"ăn trưa","currency":"VND"},
  "status":"pending",
  "expiresAt":"2026-11-07T08:10:00.000Z"
}
```

Ngân sách có `kind: create_budget`, preview gồm `categoryName`, `limitAmount`, `month`, `currency`. Chưa có giao dịch hoặc ngân sách mới tại bước này.

### Xác nhận hoặc hủy

- `POST /actions/:id/confirm` body `{}`: trả `{success:true,data:{kind,resultId,record}}` khi đã commit thành công. Số dư, bản ghi và trạng thái action ghi trong cùng MongoDB transaction. Retry cùng ID trả kết quả đã lưu, không ghi lần hai. Sau khi commit mới phát realtime.
- `POST /actions/:id/cancel` body `{}`: trả `{success:true,data:{id,status:"cancelled"}}`. Hủy lại an toàn. Hủy action đã xác nhận trả 409.
- `GET /conversations/:id`: trả `{success:true,data:{conversationId,messages:[{role:"user",text:"..."},{role:"model",text:"..."}],pendingAction}}`.

Chỉ chủ sở hữu được đọc/thực hiện. Client không được gửi payload thay thế lúc xác nhận. Bản nháp hết hạn sau 10 phút; bản nháp mới thay thế bản cũ. Sửa nội dung phải tạo và xác nhận bản nháp mới. Ngân sách trùng danh mục/tháng báo xung đột, không ghi đè.

## Hợp đồng frontend

API client: `src/api/chat.ts`. KAN-34 chưa tạo màn hình chat.

- Trước khi dùng chat, thông báo nội dung chat và số liệu tài chính cần thiết sẽ gửi tới Gemini; nhắc không nhập PIN/mật khẩu. Backend không chủ động gửi JWT, PIN, email, số tài khoản từ hồ sơ; không bảo đảm loại bỏ thông tin nhạy cảm do người dùng tự gõ.
- Hiển thị đầy đủ bản xem trước và nút **Xác nhận/Hủy**, chỉ cho xác nhận khi trạng thái `pending` và còn hạn. Tin nhắn “đồng ý” không thay thế nút xác nhận.
- Chỉ báo đã lưu sau khi endpoint confirm trả thành công. Lỗi mạng khi confirm: có thể thử lại cùng action ID; không tự tạo giao dịch mới.
- Refresh ví/giao dịch/ngân sách sau khi xác nhận. Khi đổi tài khoản, xóa hội thoại đang hiển thị ở client.
- Provider lỗi thì hiển thị lỗi và cho thử lại, không tạo câu trả lời hoặc giao dịch giả offline.

## Giới hạn, lưu trữ và lỗi

2.000 ký tự/tin; giữ 40 tin gần nhất (tối đa 64 KiB), gửi 20 tin gần nhất làm ngữ cảnh. Các function-call/result trong lượt hiện tại giữ nguyên chữ ký; chỉ lưu văn bản hội thoại khi lượt hoàn tất. Tối đa 4 vòng/8 tool calls, 30 giây gọi AI và công cụ đọc. Một lượt đang chạy khóa hội thoại tối đa 45 giây để phục hồi khi process chết. MongoDB counter giới hạn 10 tin/phút/user và 30 confirm/cancel/phút/user, dùng chung giữa các instance.

Hội thoại và action lưu 30 ngày; action chỉ confirm trong 10 phút, kết quả đã confirmed còn được truy lại trong thời gian lưu. Kiểm tra thời hạn trong code, không chờ TTL dọn. Tối đa 100 ví/danh mục/nhóm thống kê; vượt giới hạn báo rõ, không trả tổng bị cắt cụt. Không log nội dung chat, số liệu hoặc khóa; lỗi có requestId.

Lỗi chat: `{success:false,code,message,requestId}`. Middleware JWT hiện có có thể chỉ trả `{success:false,message}` cho lỗi token.

| HTTP | Ví dụ code | Xử lý |
|---|---|---|
| 400 | INVALID_INPUT, INSUFFICIENT_BALANCE | Bổ sung/sửa dữ liệu hoặc đổi ví |
| 401/403 | UNAUTHORIZED, ACCOUNT_LOCKED | Đăng nhập lại hoặc liên hệ quản trị |
| 404 | NOT_FOUND | Không tồn tại hoặc không thuộc tài khoản |
| 409 | CHAT_BUSY, ACTION_CONFLICT, ACTION_CANCELLED, ACTION_DUPLICATE | Chờ lượt trước hoặc tạo bản nháp mới |
| 410 | ACTION_EXPIRED | Tạo và kiểm tra lại bản nháp |
| 429 | CHAT_RATE_LIMIT, AI_RATE_LIMIT | Đợi theo Retry-After |
| 502 | AI_INVALID_RESPONSE, AI_INVALID_TOOL, AI_TOOL_LIMIT | Thử lại hoặc hỏi cụ thể hơn |
| 503 | AI_NOT_CONFIGURED, AI_UNAVAILABLE, AUTH_UNAVAILABLE, TRANSACTION_UNSUPPORTED | Kiểm tra cấu hình/dịch vụ; không tự retry ghi bằng ID mới |
| 504 | AI_TIMEOUT | Thử lại câu hỏi |

## Kiểm thử

```sh
npm test --prefix server -- --runInBand
npm test -- --runInBand
npm run type-check
```

`server/tests/chat.integration.test.js` dùng mongodb-memory-server khởi tạo replica set tạm, không kết nối database ứng dụng và không cần Docker. Lần đầu cần mạng để tải MongoDB 7.0.14 (Windows khoảng 592 MB); các lần sau dùng cache. Kiểm thử xác nhận đồng thời, rollback, quyền sở hữu, hết hạn, số dư và trùng ngân sách trên MongoDB thật. Gemini transport và hội thoại dùng mock, không tiêu tốn quota thật. Muốn smoke test live: cấu hình khóa/model, đăng nhập, gọi `/messages` để hỏi hướng dẫn trước; không dùng tài khoản hoặc ví sản xuất để thử ghi.
