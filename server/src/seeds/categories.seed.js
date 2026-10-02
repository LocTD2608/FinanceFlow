/**
 * Seed danh mục mặc định của hệ thống (userId = null).
 * Gồm ~20 categories: 13 Chi + 7 Thu.
 */

const DEFAULT_CATEGORIES = [
  // ===== CHI =====
  { name: 'Ăn uống',          type: 'expense', icon: 'utensils',       color: '#F97316', isDefault: true },
  { name: 'Đi lại',           type: 'expense', icon: 'car',            color: '#3B82F6', isDefault: true },
  { name: 'Mua sắm',          type: 'expense', icon: 'shopping-cart',  color: '#EC4899', isDefault: true },
  { name: 'Giải trí',         type: 'expense', icon: 'film',           color: '#8B5CF6', isDefault: true },
  { name: 'Hóa đơn & Tiện ích', type: 'expense', icon: 'zap',          color: '#EAB308', isDefault: true },
  { name: 'Sức khỏe & Y tế', type: 'expense', icon: 'heart-pulse',    color: '#EF4444', isDefault: true },
  { name: 'Giáo dục',         type: 'expense', icon: 'book-open',      color: '#06B6D4', isDefault: true },
  { name: 'Nhà ở',            type: 'expense', icon: 'home',           color: '#10B981', isDefault: true },
  { name: 'Du lịch',          type: 'expense', icon: 'plane',          color: '#6366F1', isDefault: true },
  { name: 'Thời trang',       type: 'expense', icon: 'shirt',          color: '#F43F5E', isDefault: true },
  { name: 'Gia đình & Con cái', type: 'expense', icon: 'baby',         color: '#FB923C', isDefault: true },
  { name: 'Thú cưng',         type: 'expense', icon: 'paw-print',      color: '#A78BFA', isDefault: true },
  { name: 'Khác (Chi)',       type: 'expense', icon: 'circle-ellipsis', color: '#6B7280', isDefault: true },

  // ===== THU =====
  { name: 'Lương',            type: 'income',  icon: 'briefcase',      color: '#22C55E', isDefault: true },
  { name: 'Thưởng',          type: 'income',  icon: 'gift',           color: '#F59E0B', isDefault: true },
  { name: 'Đầu tư',          type: 'income',  icon: 'trending-up',    color: '#14B8A6', isDefault: true },
  { name: 'Kinh doanh',      type: 'income',  icon: 'store',          color: '#84CC16', isDefault: true },
  { name: 'Tiền phụ thu',    type: 'income',  icon: 'wallet',         color: '#38BDF8', isDefault: true },
  { name: 'Cho vay thu hồi', type: 'income',  icon: 'hand-coins',     color: '#A3E635', isDefault: true },
  { name: 'Khác (Thu)',      type: 'income',  icon: 'circle-ellipsis', color: '#6B7280', isDefault: true },
];

module.exports = DEFAULT_CATEGORIES;
