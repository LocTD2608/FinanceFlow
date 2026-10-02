/**
 * 🌱 Seed Entry Point – FinanceFlow Dev Database
 *
 * Cách chạy:  npm run seed   (từ thư mục server/)
 *
 * ⚠️  Script sẽ XÓA toàn bộ data cũ trước khi seed.
 *     KHÔNG chạy trên môi trường Production!
 */

require('dotenv').config();
const mongoose = require('mongoose');

const Category        = require('../models/Category');
const User            = require('../models/User');
const Wallet          = require('../models/Wallet');
const Transaction     = require('../models/Transaction');
const Budget          = require('../models/Budget');
const BillReminder    = require('../models/BillReminder');
const NetWorthSnapshot = require('../models/NetWorthSnapshot');

const DEFAULT_CATEGORIES = require('./categories.seed');
const { getDemoData }    = require('./demo.seed');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/financeflow_dev';

// ──────────────────────────────────────────────
const log = {
  info:    (msg) => console.log(`  ℹ️  ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  warn:    (msg) => console.log(`  ⚠️  ${msg}`),
  section: (msg) => console.log(`\n📦 ${msg}`),
};
// ──────────────────────────────────────────────

async function seedCategories() {
  log.section('Seed Categories (danh mục mặc định)');
  await Category.deleteMany({ isDefault: true });
  const inserted = await Category.insertMany(DEFAULT_CATEGORIES);
  log.success(`Đã seed ${inserted.length} danh mục mặc định`);

  // Tạo map name -> _id để dùng ở bước sau
  const categoryMap = {};
  inserted.forEach(c => { categoryMap[c.name] = c._id; });
  return categoryMap;
}

async function seedDemoData(categoryMap) {
  log.section('Seed Demo Data (user + wallets + transactions + budgets + ...)');

  // Xóa data cũ của user demo (nếu tồn tại)
  const existingUser = await User.findOne({ email: 'demo@financeflow.vn' });
  if (existingUser) {
    const uid = existingUser._id;
    log.warn('Phát hiện user demo cũ → Đang xóa dữ liệu liên quan...');
    await Promise.all([
      Wallet.deleteMany({ userId: uid }),
      Transaction.deleteMany({ userId: uid }),
      Budget.deleteMany({ userId: uid }),
      BillReminder.deleteMany({ userId: uid }),
      NetWorthSnapshot.deleteMany({ userId: uid }),
      User.deleteOne({ _id: uid }),
    ]);
  }

  const { user, wallets, transactions, budgets, billReminders, netWorthSnapshot } = await getDemoData(categoryMap);

  // 1. Tạo user
  const createdUser = await User.create(user);
  const userId = createdUser._id;
  log.success(`Đã tạo user demo: ${createdUser.email}`);

  // 2. Tạo wallets
  const walletDocs = await Wallet.insertMany(wallets.map(w => ({ ...w, userId })));
  log.success(`Đã tạo ${walletDocs.length} ví`);
  const cashWallet = walletDocs[0]; // Ví tiền mặt
  const bankWallet = walletDocs[1]; // MB Bank

  // 3. Tạo transactions
  const txDocs = transactions.map(t => {
    const { categoryName, daysAgo, ...rest } = t;
    const categoryId = categoryMap[categoryName];
    if (!categoryId) {
      log.warn(`Không tìm thấy category: "${categoryName}" – bỏ qua giao dịch này`);
      return null;
    }
    // Chi tiền mặt, thu vào bank
    const walletId = t.type === 'income' ? bankWallet._id : cashWallet._id;
    return { ...rest, userId, walletId, categoryId };
  }).filter(Boolean);

  await Transaction.insertMany(txDocs);
  log.success(`Đã tạo ${txDocs.length} giao dịch`);

  // 4. Tạo budgets
  const budgetDocs = budgets.map(b => {
    const { categoryName, ...rest } = b;
    const categoryId = categoryMap[categoryName];
    return categoryId ? { ...rest, userId, categoryId } : null;
  }).filter(Boolean);

  await Budget.insertMany(budgetDocs);
  log.success(`Đã tạo ${budgetDocs.length} ngân sách`);

  // 5. Tạo bill reminders
  await BillReminder.insertMany(billReminders.map(b => ({ ...b, userId })));
  log.success(`Đã tạo ${billReminders.length} nhắc hóa đơn`);

  // 6. Tạo net worth snapshot
  await NetWorthSnapshot.create({ ...netWorthSnapshot, userId });
  log.success('Đã tạo 1 net worth snapshot');
}

async function main() {
  console.log('\n🌱 FinanceFlow – Seed Database (Dev)');
  console.log('━'.repeat(40));
  log.info(`Kết nối tới: ${MONGODB_URI}`);

  await mongoose.connect(MONGODB_URI);
  log.success('Kết nối MongoDB thành công!\n');

  const categoryMap = await seedCategories();
  await seedDemoData(categoryMap);

  console.log('\n' + '━'.repeat(40));
  console.log('🎉 Seed hoàn tất! Môi trường Dev đã sẵn sàng.\n');
  console.log('   👤 User demo : demo@financeflow.vn');
  console.log('   🔑 Password  : Demo@1234\n');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Seed thất bại:', err.message);
  mongoose.disconnect();
  process.exit(1);
});
