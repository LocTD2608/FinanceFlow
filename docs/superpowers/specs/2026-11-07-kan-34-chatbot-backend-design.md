# KAN-34 — Backend chatbot FinanceFlow với Gemini

Trạng thái: Người dùng đã duyệt ngày 2026-11-07.

## Mục tiêu và phạm vi đã thống nhất

Chatbot hỗ trợ người dùng FinanceFlow bằng tiếng Việt: hướng dẫn sử dụng app, trả lời từ dữ liệu tài chính cá nhân, gợi ý quản lý chi tiêu, và thực hiện thao tác có xác nhận. Người dùng đã chọn Gemini API; backend kiểm soát việc đọc và ghi dữ liệu. Thao tác ghi giới hạn ở thêm khoản thu/chi và tạo ngân sách. Mục tiêu là có API chatbot hoạt động với dữ liệu thật và hợp đồng rõ ràng cho phía ứng dụng.

Đề xuất phạm vi bàn giao KAN-34: backend, API client TypeScript để frontend tích hợp, tài liệu cấu hình/API và kiểm thử. Chưa xây màn hình chat mới vì task yêu cầu backend và repository chưa có màn hình chatbot. Không chuyển tiền, thanh toán, sửa/xóa giao dịch, tự động đầu tư hay thực thi mã do AI sinh. Gợi ý chỉ hỗ trợ lập ngân sách và thói quen chi tiêu.

## Hiện trạng và ràng buộc

- Backend Express/CommonJS, MongoDB/Mongoose; ứng dụng Expo/TypeScript gọi API bằng JWT.
- Có models ví, giao dịch, danh mục và ngân sách, các quy tắc số dư và danh mục dùng chung. Ngày tài chính sử dụng UTC+7 qua `utils/period.js`.
- Chưa thấy tích hợp AI hoặc cấu hình AI trong `.env.example`.
- Luồng tạo giao dịch hiện tại cập nhật số dư rồi lưu, có hoàn tác nhưng chưa dùng MongoDB transaction. Luồng chatbot cần đảm bảo bản nháp, giao dịch và số dư được chốt nguyên tử, không gọi controller hiện tại theo cách bỏ qua yêu cầu này.
- Repository đã có `runInTransaction`; thao tác ghi chatbot yêu cầu MongoDB Atlas hoặc replica set. Nếu database không hỗ trợ thì trả lỗi rõ, không hạ xuống luồng ghi thiếu tính nguyên tử. Hỏi đáp vẫn có thể sử dụng MongoDB standalone.

## Approaches

1. **Gemini function calling + backend kiểm soát (người dùng chọn):** linh hoạt cho câu hỏi tiếng Việt, truy vấn dữ liệu và đề xuất thao tác. Backend phải kiểm tra mọi tham số AI tạo ra và giới hạn công cụ.
2. **Dialogflow CX + webhook:** có các luồng và trường dữ liệu tường minh, nhưng cần cấu hình agent/cloud riêng và nhiều kịch bản hơn cho hỏi đáp mở. Không tích hợp song song trong KAN-34.

Tham khảo chính thức đã khảo sát:
- https://ai.google.dev/gemini-api/docs/function-calling
- https://docs.cloud.google.com/dialogflow/cx/docs/basics

## Thiết kế đề xuất

### Hội thoại và truy vấn

API chỉ nhận nội dung người dùng và ID hội thoại; lịch sử do server lưu, không nhận system prompt/tool result/userId từ client. Mỗi hội thoại thuộc một user, giữ ngữ cảnh gần nhất có giới hạn. Một lượt mới trong cùng hội thoại được xử lý tại một thời điểm; dùng khóa có thời hạn trong MongoDB để tránh ghi đè khi gửi đồng thời. Lưu tối đa 40 tin nhắn gần nhất; gửi tối đa 20 tin gần nhất cho AI, cắt giới hạn dung lượng và không làm đứt cặp function-call/result. Không xây API duyệt mọi hội thoại trong phiên bản đầu.

Các công cụ đọc được cho phép:
- Hướng dẫn tĩnh dựa trên chức năng thực tế của app.
- Danh sách ví đang hoạt động và danh mục khả dụng để người dùng chọn chính xác.
- Tổng thu/chi theo ngày/tuần/tháng/năm, số dư ví, chi theo danh mục và ngân sách cùng mức đã dùng. Dùng dữ liệu tổng hợp, không gửi toàn bộ lịch sử giao dịch.

Mọi truy vấn gắn userId từ JWT ở backend. AI không được truyền điều kiện MongoDB, userId, URL tùy ý hoặc tên hàm ngoài danh sách. Ngày mặc định và cách hiểu “hôm nay/tháng này” dùng UTC+7, VND là đơn vị tiền của phiên bản này. Thu/chi thực tế không cộng giao dịch chuyển tiền vào thống kê. Số liệu do backend tính; câu trả lời trả kèm dữ liệu nguồn có cấu trúc để frontend hiển thị/đối chiếu, vì văn bản AI vẫn có thể diễn giải sai.

Gợi ý sử dụng tổng thu/chi, các nhóm chi lớn và ngân sách hiện có. Khi thiếu dữ liệu, chatbot nói rõ và hỏi thêm; không tự suy ra thu nhập hoặc số dư. Hướng dẫn sử dụng dựa trên tài liệu tĩnh, không khẳng định app có chức năng chưa triển khai.

### Bản nháp và xác nhận

AI chỉ được đề xuất hai loại action: `create_transaction` (income/expense) và `create_budget`. Một lượt tạo tối đa một bản nháp. Thiếu thông tin hoặc có nhiều ví/danh mục trùng tên thì hỏi lại. Không tự chọn ví/danh mục bất kỳ. Ngày giao dịch có thể mặc định hôm nay, tháng ngân sách có thể mặc định tháng hiện tại nhưng phải xuất hiện trong bản xem trước.

Backend kiểm tra số tiền hữu hạn, dương cho giao dịch; hạn mức ngân sách hữu hạn và không âm theo quy tắc hiện có; ngày/tháng hợp lệ; danh mục khớp loại; ví đang hoạt động thuộc user; ghi chú bắt buộc cho danh mục Khác. Ngân sách chỉ dùng danh mục chi. Kiểm tra lại các điều kiện tại thời điểm xác nhận, gồm đủ số dư với ví không phải thẻ tín dụng.

Lưu `ChatAction`: chủ sở hữu, hội thoại, loại, payload đã chuẩn hóa, bản xem trước, trạng thái pending/confirmed/cancelled/expired, thời hạn và kết quả. Bản nháp hết hạn sau 10 phút. Mỗi hội thoại có tối đa một action pending; đề xuất mới hủy bản nháp cũ. Muốn sửa nội dung thì tạo bản nháp mới và xác nhận lại.

Xác nhận là API riêng do hành động rõ ràng trên client (nút xác nhận) gọi; AI không có công cụ xác nhận, và tin nhắn “đồng ý” tự nó không ghi dữ liệu. Client chỉ gửi actionId, không gửi payload thay thế.

Trong MongoDB transaction: kiểm tra/claim action còn pending và chưa hết hạn, kiểm tra quyền và dữ liệu mới nhất, tạo giao dịch + cập nhật số dư hoặc tạo ngân sách, chuyển action thành confirmed và lưu resultId. Retry/bấm hai lần trả lại kết quả đã lưu; cạnh tranh đồng thời không được tạo hai bản ghi. Ngân sách trùng danh mục/tháng trả lỗi xung đột, không ghi đè. Lỗi làm rollback toàn bộ, không để số dư đổi mà không có giao dịch. Phát thông báo realtime chỉ sau commit thành công; không phát lại khi retry action đã confirmed.

Tái sử dụng helper nghiệp vụ nơi phù hợp hoặc tách helper nhỏ có hỗ trợ session; không đổi hành vi API giao dịch hiện có ngoài phần cần thiết có kiểm thử hồi quy.

### Hợp đồng API

Tất cả dưới `/api/chat`, yêu cầu JWT:
- `POST /messages` với `{ message, conversationId? }`: trả `{ conversationId, reply, facts?, pendingAction? }` trong envelope `{ success, data }`. Tạo hội thoại khi chưa có ID.
- `GET /conversations/:id`: trả lịch sử gần nhất và bản nháp hiện tại, chỉ cho chủ sở hữu.
- `POST /actions/:id/confirm`: thực hiện đúng bản nháp đã lưu, trả kết quả giao dịch/ngân sách; retry trả kết quả cũ.
- `POST /actions/:id/cancel`: hủy bản nháp; hủy lại là an toàn, action đã confirmed báo xung đột.

Lỗi dùng envelope `{ success: false, code, message }`. Không thấy tài nguyên của user khác trả 404. Phân biệt 400 đầu vào, 401/403 xác thực, 409 xung đột, 410 hết hạn, 429 giới hạn, 502 phản hồi AI không hợp lệ, 503 thiếu cấu hình/dịch vụ hoặc MongoDB transaction không hỗ trợ, 504 timeout AI. API client TypeScript bọc các endpoint và kiểu dữ liệu, không chứa API key.

### Gemini và giới hạn vận hành

Service riêng gọi Gemini qua SDK chính thức hoặc REST theo tài liệu được xác minh lúc triển khai; model cấu hình bằng `GEMINI_MODEL`, khóa `GEMINI_API_KEY` chỉ đặt ở server. Không hardcode model đã hết hỗ trợ. Không cần tạo tài khoản/billing hoặc đưa khóa thật vào Git.

Giới hạn đề xuất: tin nhắn 2.000 ký tự; tối đa 4 vòng công cụ và 8 lời gọi công cụ mỗi lượt; timeout tổng lượt 30 giây có hủy request; output token có giới hạn. Giới hạn 10 lượt AI/phút/user tại backend (MongoDB atomic counter có TTL để dùng được nhiều instance). Áp dụng giới hạn xác nhận riêng để không phụ thuộc quota AI. Không tự retry thao tác ghi từ phía model.

Backend không lấy JWT, email, số tài khoản, PIN hoặc thông tin đăng nhập từ hồ sơ/cấu hình để đưa vào prompt hay tool result. Nội dung người dùng tự nhập trong chat và dữ liệu tối thiểu cần để trả lời (tổng tiền, tên ví/danh mục) được gửi cho Gemini; phiên bản này không cam kết tự phát hiện và loại bỏ mọi thông tin nhạy cảm trong văn bản tự do. Tài liệu tích hợp yêu cầu frontend thông báo việc gửi nội dung tới Gemini và nhắc người dùng không nhập mật khẩu/PIN trước khi dùng chat. Không log nguyên tin nhắn, nội dung tài chính hoặc khóa; log mã lỗi và request ID. Nội dung hội thoại lưu MongoDB, TTL 30 ngày; action cũng giữ 30 ngày kể từ tạo để phục vụ retry. Kiểm tra `expiresAt` trong code, không phụ thuộc TTL xóa đúng thời điểm. Không quảng cáo cơ chế prompt là bảo đảm an toàn: quyền truy cập và khả năng ghi được chặn bằng code.

Thiếu khóa trả lỗi cấu hình rõ ràng; kiểm thử dùng provider giả lập, không trả lời giả như AI thật. Xác nhận bản nháp đã có không cần Gemini hoạt động.

## Kiểm thử và tiêu chí nghiệm thu

- Hướng dẫn, truy vấn dữ liệu và gợi ý trả đúng ngữ cảnh trong bộ kiểm thử Gemini giả lập; dữ liệu tổng hợp đúng kỳ UTC+7 và đúng user.
- Tin nhắn tạo thu/chi/ngân sách chưa làm thay đổi dữ liệu tài chính; thiếu thông tin hỏi thêm; xác nhận mới ghi, hủy/hết hạn không ghi.
- Không truy cập hội thoại/action/ví/danh mục người khác; không thực thi tool lạ hoặc tham số lỗi; không nhận lịch sử giả từ client.
- Kiểm tra hai lần xác nhận, xác nhận đồng thời, thất bại giữa cập nhật số dư và lưu giao dịch, rollback, thiếu số dư và ngân sách trùng.
- Kiểm thử route với Supertest, service với Jest; kiểm thử transaction/concurrency thật trên MongoDB replica set nếu môi trường cung cấp. Nếu không có thì ghi rõ chưa xác minh tích hợp thật, không coi mock là bằng chứng transaction thực.
- Kiểm thử AI timeout, rate limit, lỗi upstream, phản hồi sai cấu trúc và thiếu cấu hình; type-check client; chạy regression backend.
- Ghi tài liệu setup, cấu hình, request/response mẫu và cập nhật tài liệu API hiện có. Smoke test Gemini thật chỉ khi môi trường có khóa hợp lệ; không yêu cầu gửi khóa trong chat và không tuyên bố đã kiểm thử live nếu chưa làm.

## Bàn giao và việc để người triển khai quyết định

Sau khi duyệt thiết kế: viết kế hoạch chi tiết, triển khai, kiểm thử, rà soát diff, commit và push nhánh `feat/financial-center`. Commit theo mẫu `feat(chatbot): KAN-34 Tich hop logic backend cho chatbot`. Không tự merge.

Người triển khai chọn tên file/helper, thư viện tối thiểu, model Gemini hiện được hỗ trợ, cấu trúc schema cụ thể và cách tổ chức test. Mọi thay đổi mở rộng sang màn hình chat hoặc loại thao tác mới phải được chốt riêng.
