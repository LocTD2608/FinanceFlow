/**
 * Unit test cho luồng xử lý Transaction và tính toán số dư Ví.
 * Mongoose models được mock toàn diện, kiểm tra chính xác các phép cộng/trừ số dư.
 */
const mongoose = require('mongoose');

jest.mock('../src/models/Transaction', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  deleteOne: jest.fn(),
  countDocuments: jest.fn(),
  aggregate: jest.fn(),
}));

jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../src/models/Category', () => ({
  findOne: jest.fn(),
}));

const Transaction = require('../src/models/Transaction');
const Wallet = require('../src/models/Wallet');
const Category = require('../src/models/Category');
const ctrl = require('../src/controllers/transaction.controller');

// ───────── Helpers ─────────
const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();
const WALLET_ID = newId();
const DEST_WALLET_ID = newId();
const CAT_EXPENSE_ID = newId();
const CAT_INCOME_ID = newId();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (overrides = {}) => ({
  user: { id: USER_ID },
  params: {},
  query: {},
  body: {},
  ...overrides,
});

const queryChain = (value) => {
  const q = {
    sort: () => q,
    skip: () => q,
    limit: () => q,
    populate: () => q,
    lean: () => q,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const makeWallet = (overrides = {}) => ({
  _id: WALLET_ID,
  userId: USER_ID,
  name: 'Ví tiền mặt',
  type: 'cash',
  balance: 1000000,
  currency: 'VND',
  isArchived: false,
  save: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const makeCategory = (overrides = {}) => ({
  _id: CAT_EXPENSE_ID,
  userId: null,
  name: 'Ăn uống',
  type: 'expense',
  icon: 'utensils',
  color: '#F97316',
  isDefault: true,
  isDeleted: false,
  ...overrides,
});

const makeTransaction = (overrides = {}) => ({
  _id: newId(),
  userId: USER_ID,
  walletId: WALLET_ID,
  categoryId: CAT_EXPENSE_ID,
  destinationWalletId: null,
  amount: 50000,
  type: 'expense',
  transactionDate: new Date(),
  note: 'Ăn phở sáng',
  save: jest.fn().mockResolvedValue(undefined),
  deleteOne: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const body = (res) => res.json.mock.calls[0][0];

beforeEach(() => {
  jest.resetAllMocks();
});

// ──────────────────────────────────────────────
// 1. TẠO GIAO DỊCH (POST /api/transactions)
// ──────────────────────────────────────────────
describe('create transaction & balance updates', () => {
  it('thiếu amount hoặc amount <= 0 -> 400', async () => {
    const res = mockRes();
    await ctrl.create(mockReq({ body: { amount: 0, type: 'expense', walletId: WALLET_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toMatch(/số tiền/i);
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('loại giao dịch (type) không hợp lệ -> 400', async () => {
    const res = mockRes();
    await ctrl.create(mockReq({ body: { amount: 50000, type: 'invalid_type', walletId: WALLET_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('ví nguồn không tồn tại hoặc không thuộc user -> 404', async () => {
    Wallet.findOne.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.create(mockReq({ body: { amount: 50000, type: 'expense', walletId: WALLET_ID, categoryId: CAT_EXPENSE_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(body(res).message).toMatch(/ví/i);
  });

  it('ví nguồn đã bị lưu trữ (archived) -> 400', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet({ isArchived: true }));
    const res = mockRes();
    await ctrl.create(mockReq({ body: { amount: 50000, type: 'expense', walletId: WALLET_ID, categoryId: CAT_EXPENSE_ID } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toMatch(/lưu trữ/i);
  });

  it('chi tiêu (expense): trừ số dư ví nguồn (-amount) thành công', async () => {
    const sourceWallet = makeWallet({ balance: 1000000 });
    const category = makeCategory({ type: 'expense' });
    Wallet.findOne.mockResolvedValue(sourceWallet);
    Category.findOne.mockResolvedValue(category);
    Wallet.findOneAndUpdate.mockResolvedValue({ ...sourceWallet, balance: 950000 });
    Transaction.create.mockResolvedValue(makeTransaction({ amount: 50000, type: 'expense' }));

    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: {
          amount: 50000,
          type: 'expense',
          walletId: WALLET_ID,
          categoryId: CAT_EXPENSE_ID,
          note: 'Cà phê',
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    // Khoản trừ là cập nhật có điều kiện: ví thường phải còn đủ số dư
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: WALLET_ID, $or: [{ type: 'credit_card' }, { balance: { $gte: 50000 } }] },
      { $inc: { balance: -50000 } },
      { new: true }
    );
    expect(body(res).success).toBe(true);
  });

  it('thu nhập (income): cộng số dư ví nguồn (+amount) thành công', async () => {
    const sourceWallet = makeWallet({ balance: 2000000 });
    const category = makeCategory({ _id: CAT_INCOME_ID, type: 'income', name: 'Lương' });
    Wallet.findOne.mockResolvedValue(sourceWallet);
    Category.findOne.mockResolvedValue(category);
    Wallet.findByIdAndUpdate.mockResolvedValue({ ...sourceWallet, balance: 12000000 });
    Transaction.create.mockResolvedValue(makeTransaction({ amount: 10000000, type: 'income' }));

    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: {
          amount: 10000000,
          type: 'income',
          walletId: WALLET_ID,
          categoryId: CAT_INCOME_ID,
          note: 'Lương tháng',
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    // Kiểm tra Wallet.findByIdAndUpdate được gọi với $inc: { balance: 10000000 }
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: 10000000 } },
      { new: true }
    );
    expect(body(res).success).toBe(true);
  });

  it('chuyển khoản (transfer): ví đích trùng ví nguồn -> 400', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet());
    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: {
          amount: 500000,
          type: 'transfer',
          walletId: WALLET_ID,
          destinationWalletId: WALLET_ID,
        },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toMatch(/khác/i);
  });

  it('chuyển khoản (transfer): ví đích không tồn tại hoặc không thuộc user -> 404', async () => {
    Wallet.findOne
      .mockResolvedValueOnce(makeWallet()) // source wallet ok
      .mockResolvedValueOnce(null); // dest wallet not found
    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: {
          amount: 500000,
          type: 'transfer',
          walletId: WALLET_ID,
          destinationWalletId: DEST_WALLET_ID,
        },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(body(res).message).toMatch(/ví đích/i);
  });

  it('chuyển khoản (transfer): trừ ví nguồn (-amount), cộng ví đích (+amount)', async () => {
    const sourceWallet = makeWallet({ _id: WALLET_ID, balance: 2000000 });
    const destWallet = makeWallet({ _id: DEST_WALLET_ID, balance: 500000, name: 'MB Bank' });

    Wallet.findOne
      .mockResolvedValueOnce(sourceWallet)
      .mockResolvedValueOnce(destWallet);

    Wallet.findByIdAndUpdate.mockResolvedValueOnce({ ...destWallet, balance: 1000000 });
    Wallet.findOneAndUpdate.mockResolvedValueOnce({ ...sourceWallet, balance: 1500000 });

    Transaction.create.mockResolvedValue(
      makeTransaction({
        amount: 500000,
        type: 'transfer',
        walletId: WALLET_ID,
        destinationWalletId: DEST_WALLET_ID,
      })
    );

    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: {
          amount: 500000,
          type: 'transfer',
          walletId: WALLET_ID,
          destinationWalletId: DEST_WALLET_ID,
          note: 'Rút tiền ATM',
        },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    // Khoản cộng (ví đích) được áp trước, khoản trừ (ví nguồn) là cập nhật có điều kiện
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      DEST_WALLET_ID,
      { $inc: { balance: 500000 } },
      { new: true }
    );
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: WALLET_ID, $or: [{ type: 'credit_card' }, { balance: { $gte: 500000 } }] },
      { $inc: { balance: -500000 } },
      { new: true }
    );
  });
});

// ──────────────────────────────────────────────
// 1b. KIỂM TRA SỐ DƯ (không âm, trừ credit_card)
// ──────────────────────────────────────────────
describe('kiểm tra số dư khi chi / chuyển khoản', () => {
  const expenseBody = (amount) => ({
    amount,
    type: 'expense',
    walletId: WALLET_ID,
    categoryId: CAT_EXPENSE_ID,
  });

  it('ví thường không đủ tiền -> 400 INSUFFICIENT_BALANCE kèm shortfall, không ghi giao dịch', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet({ balance: 200000 }));
    Category.findOne.mockResolvedValue(makeCategory());

    const res = mockRes();
    await ctrl.create(mockReq({ body: expenseBody(500000) }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res)).toMatchObject({
      success: false,
      code: 'INSUFFICIENT_BALANCE',
      currentBalance: 200000,
      requiredAmount: 500000,
      shortfall: 300000,
    });
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('chi đúng bằng số dư thì được (số dư về 0)', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet({ balance: 50000 }));
    Category.findOne.mockResolvedValue(makeCategory());
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet({ balance: 0 }));
    Transaction.create.mockResolvedValue(makeTransaction({ amount: 50000 }));

    const res = mockRes();
    await ctrl.create(mockReq({ body: expenseBody(50000) }), res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('gọi đồng thời: ví bị rút trước khiến cập nhật có điều kiện thất bại -> 400 INSUFFICIENT_BALANCE', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet({ balance: 100000 }));
    Category.findOne.mockResolvedValue(makeCategory());
    Wallet.findOneAndUpdate.mockResolvedValue(null); // điều kiện $gte không còn thỏa
    Wallet.findById.mockResolvedValue(makeWallet({ balance: 10000 }));

    const res = mockRes();
    await ctrl.create(mockReq({ body: expenseBody(80000) }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res)).toMatchObject({ code: 'INSUFFICIENT_BALANCE', currentBalance: 10000, shortfall: 70000 });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('chuyển khoản vượt số dư ví nguồn -> 400 INSUFFICIENT_BALANCE', async () => {
    Wallet.findOne
      .mockResolvedValueOnce(makeWallet({ balance: 100000 }))
      .mockResolvedValueOnce(makeWallet({ _id: DEST_WALLET_ID }));

    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: { amount: 300000, type: 'transfer', walletId: WALLET_ID, destinationWalletId: DEST_WALLET_ID },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).code).toBe('INSUFFICIENT_BALANCE');
    expect(Wallet.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('thu nhập không bị kiểm tra số dư', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet({ balance: 0 }));
    Category.findOne.mockResolvedValue(makeCategory({ _id: CAT_INCOME_ID, type: 'income', name: 'Lương' }));
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet({ balance: 1000 }));
    Transaction.create.mockResolvedValue(makeTransaction({ type: 'income' }));

    const res = mockRes();
    await ctrl.create(
      mockReq({ body: { amount: 1000, type: 'income', walletId: WALLET_ID, categoryId: CAT_INCOME_ID } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('ví credit_card được chi vượt số dư (về âm), không báo thiếu số dư', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet({ type: 'credit_card', balance: 0 }));
    Category.findOne.mockResolvedValue(makeCategory());
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet({ type: 'credit_card', balance: -700000 }));
    Transaction.create.mockResolvedValue(makeTransaction({ amount: 700000 }));

    const res = mockRes();
    await ctrl.create(mockReq({ body: expenseBody(700000) }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ $or: expect.arrayContaining([{ type: 'credit_card' }]) }),
      { $inc: { balance: -700000 } },
      { new: true }
    );
  });

  it('lưu giao dịch lỗi thì hoàn tác số dư đã trừ', async () => {
    Wallet.findOne.mockResolvedValue(makeWallet({ balance: 1000000 }));
    Category.findOne.mockResolvedValue(makeCategory());
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet());
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());
    Transaction.create.mockRejectedValue(new Error('db lỗi'));

    const res = mockRes();
    await ctrl.create(mockReq({ body: expenseBody(50000) }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: 50000 } },
      { new: true }
    );
  });
});

// ──────────────────────────────────────────────
// 1c. DANH MỤC "KHÁC" BẮT BUỘC GHI CHÚ
// ──────────────────────────────────────────────
describe('danh mục "Khác" bắt buộc ghi chú', () => {
  const otherExpense = () => makeCategory({ name: 'Khác (Chi)' });
  const otherIncome = () => makeCategory({ _id: CAT_INCOME_ID, type: 'income', name: 'Khác (Thu)' });

  beforeEach(() => {
    Wallet.findOne.mockResolvedValue(makeWallet());
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet());
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());
    Transaction.create.mockResolvedValue(makeTransaction());
  });

  it('chi "Khác" không có ghi chú -> 400', async () => {
    Category.findOne.mockResolvedValue(otherExpense());
    const res = mockRes();
    await ctrl.create(
      mockReq({ body: { amount: 1000, type: 'expense', walletId: WALLET_ID, categoryId: CAT_EXPENSE_ID } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toMatch(/ghi chú/i);
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('chi "Khác" ghi chú toàn khoảng trắng -> 400', async () => {
    Category.findOne.mockResolvedValue(otherExpense());
    const res = mockRes();
    await ctrl.create(
      mockReq({ body: { amount: 1000, type: 'expense', walletId: WALLET_ID, categoryId: CAT_EXPENSE_ID, note: '   ' } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('thu "Khác" không có ghi chú -> 400', async () => {
    Category.findOne.mockResolvedValue(otherIncome());
    const res = mockRes();
    await ctrl.create(
      mockReq({ body: { amount: 1000, type: 'income', walletId: WALLET_ID, categoryId: CAT_INCOME_ID } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('"Khác" ghi chú quá 50 ký tự -> 400', async () => {
    Category.findOne.mockResolvedValue(otherExpense());
    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: { amount: 1000, type: 'expense', walletId: WALLET_ID, categoryId: CAT_EXPENSE_ID, note: 'a'.repeat(51) },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toMatch(/50/);
  });

  it('"Khác" có ghi chú hợp lệ -> 201', async () => {
    Category.findOne.mockResolvedValue(otherExpense());
    const res = mockRes();
    await ctrl.create(
      mockReq({
        body: { amount: 1000, type: 'expense', walletId: WALLET_ID, categoryId: CAT_EXPENSE_ID, note: 'Tiền gửi xe' },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('danh mục khác "Khác" để trống ghi chú vẫn được', async () => {
    Category.findOne.mockResolvedValue(makeCategory({ name: 'Ăn uống' }));
    const res = mockRes();
    await ctrl.create(
      mockReq({ body: { amount: 1000, type: 'expense', walletId: WALLET_ID, categoryId: CAT_EXPENSE_ID } }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('sửa ghi chú thành rỗng của giao dịch "Khác" -> 400', async () => {
    const tx = makeTransaction({ note: 'có ghi chú' });
    Transaction.findOne.mockResolvedValue(tx);
    Category.findOne.mockResolvedValue(otherExpense());
    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: String(tx._id) }, body: { note: '' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(tx.save).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// 1d. SỬA / XÓA KHÔNG ĐƯỢC LÀM VÍ THƯỜNG ÂM
// ──────────────────────────────────────────────
describe('sửa / xóa giao dịch không làm ví thường âm', () => {
  it('xóa giao dịch thu khi số dư ví không đủ để hoàn tác -> 400, không xóa', async () => {
    const tx = makeTransaction({ amount: 5000000, type: 'income', walletId: WALLET_ID });
    Transaction.findOne.mockResolvedValue(tx);
    Wallet.findOneAndUpdate.mockResolvedValue(null);

    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: String(tx._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).code).toBe('INSUFFICIENT_BALANCE');
    expect(tx.deleteOne).not.toHaveBeenCalled();
  });

  it('xóa chuyển khoản mà ví đích không đủ để hoàn tác -> 400 và hoàn tác ví nguồn đã cộng', async () => {
    const tx = makeTransaction({
      amount: 300000,
      type: 'transfer',
      walletId: WALLET_ID,
      destinationWalletId: DEST_WALLET_ID,
    });
    Transaction.findOne.mockResolvedValue(tx);
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());
    Wallet.findOneAndUpdate.mockResolvedValue(null);

    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: String(tx._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    // Ví nguồn đã được cộng +300k rồi phải trừ lại -300k
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: -300000 } },
      { new: true }
    );
    expect(tx.deleteOne).not.toHaveBeenCalled();
  });

  it('sửa tăng số tiền chi vượt số dư -> 400, không lưu', async () => {
    const oldTx = makeTransaction({ amount: 50000, type: 'expense', walletId: WALLET_ID });
    Transaction.findOne.mockResolvedValue(oldTx);
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());
    Wallet.findOneAndUpdate.mockResolvedValue(null);

    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: String(oldTx._id) }, body: { amount: 99999999 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).code).toBe('INSUFFICIENT_BALANCE');
    expect(oldTx.save).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// 2. SỬA GIAO DỊCH (PUT /api/transactions/:id)
// ──────────────────────────────────────────────
describe('update transaction & balance adjustments', () => {
  it('giao dịch không tồn tại -> 404', async () => {
    Transaction.findOne.mockResolvedValue(null);
    const res = mockRes();
    await ctrl.update(mockReq({ params: { id: newId() }, body: { amount: 100000 } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('sửa số tiền expense: hoàn tác số tiền cũ (+50k), trừ số tiền mới (-80k)', async () => {
    const oldTx = makeTransaction({
      amount: 50000,
      type: 'expense',
      walletId: WALLET_ID,
    });
    Transaction.findOne.mockResolvedValue(oldTx);
    Wallet.findOne.mockResolvedValue(makeWallet());
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet());

    const res = mockRes();
    await ctrl.update(
      mockReq({
        params: { id: String(oldTx._id) },
        body: { amount: 80000 },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    // Hoàn tác số tiền cũ (+50k) áp trước, rồi trừ số tiền mới (-80k) có điều kiện số dư
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: 50000 } },
      { new: true }
    );
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: WALLET_ID, $or: [{ type: 'credit_card' }, { balance: { $gte: 80000 } }] },
      { $inc: { balance: -80000 } },
      { new: true }
    );
    expect(oldTx.save).toHaveBeenCalled();
  });

  it('sửa ví nguồn expense: hoàn tác ví cũ (+50k), trừ ví mới (-50k)', async () => {
    const NEW_WALLET_ID = newId();
    const oldTx = makeTransaction({
      amount: 50000,
      type: 'expense',
      walletId: WALLET_ID,
    });
    Transaction.findOne.mockResolvedValue(oldTx);
    Wallet.findOne
      .mockResolvedValueOnce(makeWallet({ _id: NEW_WALLET_ID })) // check new wallet
      .mockResolvedValue(makeWallet());
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet({ _id: NEW_WALLET_ID }));

    const res = mockRes();
    await ctrl.update(
      mockReq({
        params: { id: String(oldTx._id) },
        body: { walletId: NEW_WALLET_ID },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    // WALLET_ID cũ phải được hoàn tác +50k
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: 50000 } },
      { new: true }
    );
    // NEW_WALLET_ID mới phải bị trừ -50k (cập nhật có điều kiện số dư)
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: NEW_WALLET_ID, $or: [{ type: 'credit_card' }, { balance: { $gte: 50000 } }] },
      { $inc: { balance: -50000 } },
      { new: true }
    );
  });
});

// ──────────────────────────────────────────────
// 3. XÓA GIAO DỊCH (DELETE /api/transactions/:id)
// ──────────────────────────────────────────────
describe('remove transaction & balance rollback', () => {
  it('xóa expense: hoàn tác lại số dư ví (+amount)', async () => {
    const tx = makeTransaction({
      amount: 70000,
      type: 'expense',
      walletId: WALLET_ID,
    });
    Transaction.findOne.mockResolvedValue(tx);
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());

    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: String(tx._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: 70000 } },
      { new: true }
    );
    expect(tx.deleteOne).toHaveBeenCalled();
  });

  it('xóa income: hoàn tác lại số dư ví (-amount)', async () => {
    const tx = makeTransaction({
      amount: 5000000,
      type: 'income',
      walletId: WALLET_ID,
    });
    Transaction.findOne.mockResolvedValue(tx);
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet());

    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: String(tx._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: WALLET_ID, $or: [{ type: 'credit_card' }, { balance: { $gte: 5000000 } }] },
      { $inc: { balance: -5000000 } },
      { new: true }
    );
    expect(tx.deleteOne).toHaveBeenCalled();
  });

  it('xóa transfer: hoàn tác ví nguồn (+amount), hoàn tác ví đích (-amount)', async () => {
    const tx = makeTransaction({
      amount: 300000,
      type: 'transfer',
      walletId: WALLET_ID,
      destinationWalletId: DEST_WALLET_ID,
    });
    Transaction.findOne.mockResolvedValue(tx);
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());
    Wallet.findOneAndUpdate.mockResolvedValue(makeWallet());

    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: String(tx._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: 300000 } },
      { new: true }
    );
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: DEST_WALLET_ID, $or: [{ type: 'credit_card' }, { balance: { $gte: 300000 } }] },
      { $inc: { balance: -300000 } },
      { new: true }
    );
    expect(tx.deleteOne).toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────
// 4. DANH SÁCH & PHÂN TRANG (GET /api/transactions)
// ──────────────────────────────────────────────
describe('list transactions', () => {
  it('trả danh sách giao dịch phân trang và lọc theo tháng', async () => {
    const list = [makeTransaction(), makeTransaction()];
    Transaction.countDocuments.mockResolvedValue(2);
    Transaction.find.mockReturnValue(queryChain(list));

    const res = mockRes();
    await ctrl.list(mockReq({ query: { month: '2026-10', page: 1, limit: 10 } }), res);

    expect(body(res).success).toBe(true);
    expect(body(res).data).toHaveLength(2);
    expect(body(res).pagination).toMatchObject({
      total: 2,
      page: 1,
      limit: 10,
      totalPages: 1,
    });
  });
});

// ──────────────────────────────────────────────
// 5. CHI TIẾT GIAO DỊCH (GET /api/transactions/:id)
// ──────────────────────────────────────────────
describe('getById transaction', () => {
  it('id sai định dạng -> 400', async () => {
    const res = mockRes();
    await ctrl.getById(mockReq({ params: { id: 'invalid-id' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('không tìm thấy -> 404', async () => {
    Transaction.findOne.mockReturnValue(queryChain(null));
    const res = mockRes();
    await ctrl.getById(mockReq({ params: { id: newId() } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('tìm thấy -> trả thông tin chi tiết', async () => {
    const tx = makeTransaction();
    Transaction.findOne.mockReturnValue(queryChain(tx));
    const res = mockRes();
    await ctrl.getById(mockReq({ params: { id: String(tx._id) } }), res);
    expect(body(res).success).toBe(true);
    expect(body(res).data).toHaveProperty('amount', 50000);
  });
});

// ──────────────────────────────────────────────
// 6. TỔNG KẾT DÒNG TIỀN (GET /api/transactions/summary)
// ──────────────────────────────────────────────
describe('summary cash flow', () => {
  it('tổng hợp thu nhập, chi tiêu và dòng tiền ròng', async () => {
    Transaction.aggregate.mockResolvedValue([
      { _id: 'income', totalAmount: 15000000, count: 2 },
      { _id: 'expense', totalAmount: 4500000, count: 12 },
    ]);

    const res = mockRes();
    await ctrl.summary(mockReq({ query: { month: '2026-10' } }), res);

    expect(body(res).success).toBe(true);
    expect(body(res).data).toEqual({
      totalIncome: 15000000,
      totalExpense: 4500000,
      netCashFlow: 10500000,
    });
  });
});

