/**
 * Migration: đổi tên 2 danh mục thu mặc định của hệ thống.
 *   Tiền phụ thu    -> Công việc phụ
 *   Cho vay thu hồi -> Vay mượn
 *
 * Chỉ đổi `name`, giữ nguyên `_id` nên các giao dịch/ngân sách cũ vẫn trỏ đúng.
 * Idempotent: chạy lại nhiều lần không lỗi, không tạo trùng.
 *
 * Cách chạy (từ thư mục server/):  npm run migrate:rename-categories
 */

const RENAMES = [
  { from: 'Tiền phụ thu', to: 'Công việc phụ' },
  { from: 'Cho vay thu hồi', to: 'Vay mượn' },
];

const systemFilter = (name) => ({
  userId: null,
  isDefault: true,
  type: 'income',
  name,
});

/**
 * @param {import('mongoose').Model} Category
 * @returns {Promise<Array<{from: string, to: string, status: 'renamed'|'skipped'}>>}
 */
async function renameIncomeCategories(Category) {
  const results = [];
  for (const { from, to } of RENAMES) {
    // Đã có danh mục tên mới thì bỏ qua để không tạo trùng tên
    const alreadyExists = await Category.exists(systemFilter(to));
    if (alreadyExists) {
      results.push({ from, to, status: 'skipped' });
      continue;
    }
    const res = await Category.updateOne(systemFilter(from), { $set: { name: to } });
    results.push({ from, to, status: res.modifiedCount > 0 ? 'renamed' : 'skipped' });
  }
  return results;
}

async function main() {
  require('dotenv').config();
  const dns = require('dns');
  dns.setServers(['8.8.8.8', '1.1.1.1']);
  const mongoose = require('mongoose');
  const Category = require('../models/Category');

  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/financeflow_dev';
  await mongoose.connect(uri);
  const results = await renameIncomeCategories(Category);
  results.forEach((r) => console.log(`  ${r.status === 'renamed' ? '✅' : '⏭️ '} ${r.from} -> ${r.to} (${r.status})`));
  await mongoose.disconnect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Migration thất bại:', err.message);
    process.exit(1);
  });
}

module.exports = { renameIncomeCategories, RENAMES };
