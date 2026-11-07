class ChatError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const bad = (message) => new ChatError(400, 'INVALID_INPUT', message);
const notFound = () => new ChatError(404, 'NOT_FOUND', 'Không tìm thấy dữ liệu.');
const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(k => !allowed.includes(k))) {
    throw bad('Tham số không hợp lệ hoặc chứa trường không được phép.');
  }
}
module.exports = { ChatError, bad, notFound, objectId, fields };
