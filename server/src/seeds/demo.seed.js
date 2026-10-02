/**
 * Seed dữ liệu demo: 1 user + 2 wallets + giao dịch + ngân sách + nhắc hóa đơn.
 * User demo: demo@financeflow.vn / Demo@1234
 */

const bcrypt = require('bcryptjs');

const getDemoData = async (categoryMap) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Hash password
  const passwordHash = await bcrypt.hash('Demo@1234', 10);

  // --- USER ---
  const user = {
    email: 'demo@financeflow.vn',
    passwordHash,
    nickname: 'Nguyễn Demo',
    username: 'Nguyễn Demo',
    phone: '0901234567',
    baseCurrency: 'VND',
    startOfWeek: 'monday',
    salaryDay: 5,
    theme: 'dark',
  };

  // --- WALLETS (userId sẽ được gán sau khi tạo user) ---
  const wallets = [
    {
      name: 'Ví tiền mặt',
      type: 'cash',
      balance: 2500000,
      currency: 'VND',
      isExcludedFromNetWorth: false,
      isArchived: false,
    },
    {
      name: 'Tài khoản MB Bank',
      type: 'bank',
      balance: 15000000,
      currency: 'VND',
      accountNumber: '0987654321',
      bankName: 'MB Bank',
      isExcludedFromNetWorth: false,
      isArchived: false,
    },
  ];

  // --- TRANSACTIONS ---
  // categoryMap: { 'Ăn uống': ObjectId, 'Lương': ObjectId, ... }
  const getDate = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d;
  };

  const transactions = [
    // Chi
    { amount: 85000,    type: 'expense', categoryName: 'Ăn uống',     note: 'Ăn trưa cơm văn phòng',      daysAgo: 0 },
    { amount: 45000,    type: 'expense', categoryName: 'Ăn uống',     note: 'Cà phê buổi sáng',            daysAgo: 1 },
    { amount: 250000,   type: 'expense', categoryName: 'Đi lại',      note: 'Đổ xăng xe máy',             daysAgo: 2 },
    { amount: 120000,   type: 'expense', categoryName: 'Ăn uống',     note: 'Ăn tối với bạn bè',          daysAgo: 3 },
    { amount: 350000,   type: 'expense', categoryName: 'Mua sắm',     note: 'Mua quần áo',                 daysAgo: 5 },
    { amount: 180000,   type: 'expense', categoryName: 'Giải trí',    note: 'Xem phim rạp',                daysAgo: 6 },
    { amount: 500000,   type: 'expense', categoryName: 'Hóa đơn & Tiện ích', note: 'Tiền điện tháng 10', daysAgo: 7 },
    { amount: 200000,   type: 'expense', categoryName: 'Sức khỏe & Y tế', note: 'Mua thuốc',            daysAgo: 8 },
    { amount: 3500000,  type: 'expense', categoryName: 'Nhà ở',       note: 'Tiền thuê nhà tháng 10',     daysAgo: 10 },
    { amount: 75000,    type: 'expense', categoryName: 'Ăn uống',     note: 'Grab Food',                  daysAgo: 11 },
    { amount: 150000,   type: 'expense', categoryName: 'Giáo dục',    note: 'Học phí khóa online',        daysAgo: 14 },
    { amount: 90000,    type: 'expense', categoryName: 'Đi lại',      note: 'Grab xe đi làm',             daysAgo: 15 },
    // Thu
    { amount: 15000000, type: 'income',  categoryName: 'Lương',       note: 'Lương tháng 10',             daysAgo: 12 },
    { amount: 2000000,  type: 'income',  categoryName: 'Thưởng',     note: 'Thưởng dự án Q3',            daysAgo: 13 },
    { amount: 500000,   type: 'income',  categoryName: 'Tiền phụ thu', note: 'Làm thêm freelance',       daysAgo: 16 },
  ];

  // --- BUDGETS ---
  const budgets = [
    { categoryName: 'Ăn uống',  limitAmount: 3000000, period: 'salary_cycle' },
    { categoryName: 'Đi lại',   limitAmount: 1000000, period: 'monthly' },
    { categoryName: 'Mua sắm',  limitAmount: 2000000, period: 'monthly' },
  ];

  // --- BILL REMINDERS ---
  const getFutureDate = (daysFromNow) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    return d;
  };

  const billReminders = [
    { title: 'Tiền thuê nhà',   amount: 3500000, dueDate: getFutureDate(20), repeatCycle: 'monthly', status: 'pending' },
    { title: 'Tiền điện',       amount: 500000,  dueDate: getFutureDate(15), repeatCycle: 'monthly', status: 'pending' },
    { title: 'Internet + Cáp',  amount: 220000,  dueDate: getFutureDate(10), repeatCycle: 'monthly', status: 'pending' },
  ];

  return {
    user,
    wallets,
    transactions: transactions.map(t => ({
      ...t,
      transactionDate: getDate(t.daysAgo),
    })),
    budgets: budgets.map(b => ({ ...b, month: currentMonth })),
    billReminders,
    netWorthSnapshot: {
      month: currentMonth,
      totalAssets: 17500000,      // 2.5M cash + 15M bank
      totalLiabilities: 0,
      netWorth: 17500000,
      calculatedAt: new Date(),
    },
  };
};

module.exports = { getDemoData };
