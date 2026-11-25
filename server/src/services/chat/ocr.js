const { bad } = require('./errors');

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BASE64_LENGTH = 6 * 1024 * 1024; // ~4.5MB binary

/**
 * Kiểm tra và chuẩn hóa dữ liệu ảnh hóa đơn (Bill OCR) gửi kèm tin nhắn chatbot (KAN-34).
 */
function parseBillImage(body) {
  const { imageBase64, imageMimeType } = body || {};
  if (imageBase64 === undefined && imageMimeType === undefined) return null;

  if (typeof imageBase64 !== 'string' || !imageBase64.trim()) {
    throw bad('Dữ liệu ảnh hóa đơn không hợp lệ.');
  }
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(imageMimeType)) {
    throw bad('Định dạng ảnh hóa đơn không được hỗ trợ (chỉ nhận JPEG, PNG, WEBP).');
  }
  const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
  if (!cleanBase64 || cleanBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    throw bad('Kích thước ảnh hóa đơn vượt quá giới hạn cho phép.');
  }

  return {
    inlineData: {
      mimeType: imageMimeType,
      data: cleanBase64,
    },
  };
}

module.exports = {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_BASE64_LENGTH,
  parseBillImage,
};
