const mongoose = require('mongoose');
const Wallet = require('../../models/Wallet');
const Category = require('../../models/Category');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const { getPeriodRange } = require('../../utils/period');
const { visibleCategoryFilter, validateNoteForCategory } = require('../../utils/categoryRules');
const { bad, objectId, fields } = require('./errors');

const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const read = query => query.lean().maxTimeMS(5000);
const money = (n, positive = false) => typeof n === 'number' && Number.isFinite(n) && n <= Number.MAX_SAFE_INTEGER && (positive ? n > 0 : n >= 0);
const bounded = rows => {
  if (rows.length > 100) throw bad('Có quá nhiều dữ liệu để xử lý trong một lượt chat. Vui lòng dùng màn hình báo cáo.');
  return rows;
};
const GUIDE = 'FinanceFlow: tạo ví tại phần quản lý ví; ghi thu/chi bằng chức năng thêm giao dịch, chọn ví, danh mục và số tiền. '
  + 'Tạo ngân sách theo danh mục và tháng. Xem tổng thu/chi tại Dashboard và báo cáo. '
  + 'Chat hỗ trợ tra cứu và gợi ý chi tiêu, tạo bản nháp thu/chi hoặc ngân sách. '
  + 'Bản nháp chỉ được lưu thành giao dịch/ngân sách sau khi bạn bấm Xác nhận; hết hạn sau 10 phút. '
  + 'Chat không chuyển tiền, thanh toán hay sửa/xóa dữ liệu. Khi thiếu thông tin, hãy bổ sung ví, danh mục, số tiền và thời gian.';

async function validateDraft(userId, kind, input, session = null) {
  const transaction = kind === 'create_transaction';
  if (!transaction && kind !== 'create_budget') throw bad('Thao tác không được phép.');
  fields(input, transaction ? ['type', 'amount', 'walletId', 'categoryId', 'date', 'note'] : ['categoryId', 'limitAmount', 'month']);
  if (!objectId(input.categoryId)) throw bad('Hãy chọn danh mục cụ thể.');
  if (!money(transaction ? input.amount : input.limitAmount, transaction)) throw bad('Số tiền không hợp lệ.');
  const type = transaction ? input.type : 'expense';
  if (!['income', 'expense'].includes(type)) throw bad('Chỉ hỗ trợ thu hoặc chi.');
  const category = await read(Category.findOne({ _id: input.categoryId, ...visibleCategoryFilter(userId) })
    .select('_id name type isDefault userId').session(session));
  if (!category || category.type !== type) throw bad('Danh mục không tồn tại, không thuộc bạn hoặc không khớp loại.');
  if (!transaction) {
    const month = input.month === undefined ? today().slice(0, 7) : input.month;
    if (typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month) || !getPeriodRange('month', `${month}-01`)) throw bad('Tháng ngân sách không hợp lệ.');
    return { kind, payload: { categoryId: input.categoryId, limitAmount: input.limitAmount, month, period: 'monthly' },
      preview: { categoryName: category.name, limitAmount: input.limitAmount, month, currency: 'VND' } };
  }
  if (!objectId(input.walletId)) throw bad('Hãy chọn ví cụ thể.');
  const wallet = await read(Wallet.findOne({ _id: input.walletId, userId, isArchived: false })
    .select('_id name type currency balance').session(session));
  if (!wallet || wallet.currency !== 'VND') throw bad('Ví không khả dụng; chat chỉ hỗ trợ ví VND của bạn.');
  const date = input.date === undefined ? today() : input.date;
  const range = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) && getPeriodRange('day', date);
  if (!range) throw bad('Ngày giao dịch không hợp lệ.');
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > 500)) throw bad('Ghi chú tối đa 500 ký tự.');
  const note = (input.note || '').trim();
  const noteError = validateNoteForCategory(category, note);
  if (noteError) throw bad(noteError);
  return { kind, payload: { type, amount: input.amount, walletId: input.walletId, categoryId: input.categoryId,
    transactionDate: range.from.toISOString(), note },
  preview: { type, amount: input.amount, walletName: wallet.name, categoryName: category.name, date, note, currency: 'VND' } };
}

async function financialSummary(userId, args) {
  fields(args, ['period', 'date']);
  const range = getPeriodRange(args.period || 'month', args.date);
  if (!range || (args.date !== undefined && typeof args.date !== 'string')) throw bad('Kỳ hoặc ngày không hợp lệ.');
  const wallets = bounded(await read(Wallet.find({ userId }).select('_id name balance currency isArchived').limit(101)));
  if (wallets.some(w => w.currency !== 'VND')) throw bad('Báo cáo chat hiện chỉ hỗ trợ tài khoản có các ví VND.');
  const base = { userId: new mongoose.Types.ObjectId(userId), type: { $in: ['income', 'expense'] } };
  const aggregate = async (from, to) => Transaction.aggregate([
    { $match: { ...base, transactionDate: { $gte: from, $lt: to } } },
    { $group: { _id: { type: '$type', categoryId: '$categoryId' }, total: { $sum: '$amount' } } },
    { $sort: { total: -1 } }, { $limit: 101 },
  ]).option({ maxTimeMS: 5000 });
  const rows = bounded(await aggregate(range.from, range.to));
  const month = (args.date || today()).slice(0, 7);
  const monthRange = getPeriodRange('month', `${month}-01`);
  const monthRows = args.period === 'month' || !args.period ? rows : bounded(await aggregate(monthRange.from, monthRange.to));
  const budgets = bounded(await read(Budget.find({ userId, month }).select('categoryId limitAmount month period').limit(101)));
  const categories = rows.length || budgets.length
    ? bounded(await read(Category.find(visibleCategoryFilter(userId)).select('_id name type').limit(101))) : [];
  const names = new Map(categories.map(c => [String(c._id), c.name]));
  return { facts: { period: range.period, from: range.fromStr, to: range.toStr, currency: 'VND',
    income: rows.filter(r => r._id.type === 'income').reduce((sum, r) => sum + r.total, 0),
    expense: rows.filter(r => r._id.type === 'expense').reduce((sum, r) => sum + r.total, 0),
    wallets: wallets.filter(w => !w.isArchived).map(w => ({ name: w.name, balance: w.balance })),
    categories: rows.map(r => ({ type: r._id.type, name: names.get(String(r._id.categoryId)) || 'Danh mục đã xóa', total: r.total })),
    budgets: budgets.map(b => ({ categoryName: names.get(String(b.categoryId)) || 'Danh mục đã xóa', month: b.month,
      period: b.period, limitAmount: b.limitAmount,
      spentInCalendarMonth: monthRows.filter(r => r._id.type === 'expense' && String(r._id.categoryId) === String(b.categoryId)).reduce((s, r) => s + r.total, 0) })),
  } };
}

async function executeTool(userId, name, args) {
  if (name === 'draft_transaction') return { draft: await validateDraft(userId, 'create_transaction', args) };
  if (name === 'draft_budget') return { draft: await validateDraft(userId, 'create_budget', args) };
  if (name === 'financial_summary') return financialSummary(userId, args);
  fields(args, []);
  if (name === 'app_guide') return { facts: { guide: GUIDE } };
  if (name === 'list_choices') return { facts: {
    wallets: bounded(await read(Wallet.find({ userId, isArchived: false, currency: 'VND' }).select('_id name').limit(101))),
    categories: bounded(await read(Category.find(visibleCategoryFilter(userId)).select('_id name type').limit(101))),
  } };
  throw bad('Công cụ không được phép.');
}

const string = { type: 'STRING' };
const declarations = [
  { name: 'app_guide', description: 'Hướng dẫn chức năng thực tế của FinanceFlow.' },
  { name: 'list_choices', description: 'Lấy ID và tên ví, danh mục hợp lệ; hỏi người dùng chọn nếu chưa rõ.' },
  { name: 'financial_summary', description: 'Số liệu thực tế theo kỳ để trả lời và gợi ý chi tiêu. Ngân sách kèm chi theo tháng lịch.',
    parameters: { type: 'OBJECT', properties: { period: { type: 'STRING', enum: ['day', 'week', 'month', 'year'] }, date: { ...string, description: 'YYYY-MM-DD, ngày thuộc kỳ cần xem, UTC+7' } } } },
  { name: 'draft_transaction', description: 'Đề xuất bản nháp thu/chi, KHÔNG lưu giao dịch. Chỉ chọn ID khi ý định người dùng rõ ràng.',
    parameters: { type: 'OBJECT', required: ['type', 'amount', 'walletId', 'categoryId'], properties: {
      type: { type: 'STRING', enum: ['income', 'expense'] }, amount: { type: 'NUMBER' }, walletId: string, categoryId: string, date: string, note: string } } },
  { name: 'draft_budget', description: 'Đề xuất ngân sách tháng theo danh mục chi, KHÔNG lưu ngân sách.',
    parameters: { type: 'OBJECT', required: ['categoryId', 'limitAmount'], properties: { categoryId: string, limitAmount: { type: 'NUMBER' }, month: { ...string, description: 'YYYY-MM' } } } },
];
module.exports = { executeTool, validateDraft, declarations, today, GUIDE };
