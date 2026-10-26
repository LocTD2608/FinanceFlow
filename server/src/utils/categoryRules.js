/**
 * Quy tắc danh mục dùng chung: danh mục "Khác" bắt buộc ghi chú (tối đa 50 ký tự).
 */
const Category = require('../models/Category');

const OTHER_NOTE_MAX = 50;

const visibleCategoryFilter = (userId) => ({
  $or: [{ userId: null }, { userId }],
  isDeleted: { $ne: true },
});

// Danh mục "Khác" mặc định của hệ thống: Khác (Chi), Khác (Thu)
const isOtherCategory = (category) =>
  !!category && category.isDefault === true && category.userId == null && /^Khác/.test(category.name);

/**
 * Kiểm tra ghi chú theo danh mục. Trả về chuỗi lỗi, hoặc null nếu hợp lệ.
 */
const validateNoteForCategory = (category, note) => {
  if (!isOtherCategory(category)) return null;
  const text = typeof note === 'string' ? note.trim() : '';
  if (!text) return 'Vui lòng nhập ghi chú khi chọn danh mục "Khác".';
  if (text.length > OTHER_NOTE_MAX) return `Ghi chú tối đa ${OTHER_NOTE_MAX} ký tự.`;
  return null;
};

/**
 * Tìm danh mục hiển thị với user và kiểm tra khớp loại.
 * @returns {Promise<{status?: number, message?: string, category?: object}>}
 */
const findCategoryForType = async (userId, categoryId, type) => {
  const category = await Category.findOne({ _id: categoryId, ...visibleCategoryFilter(userId) });
  if (!category) return { status: 404, message: 'Không tìm thấy danh mục.' };
  if (category.type !== type) {
    return {
      status: 400,
      message: `Danh mục "${category.name}" là loại ${category.type}, không khớp với loại giao dịch ${type}.`,
    };
  }
  return { category };
};

module.exports = {
  OTHER_NOTE_MAX,
  visibleCategoryFilter,
  isOtherCategory,
  validateNoteForCategory,
  findCategoryForType,
};
