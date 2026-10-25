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
    Wallet.findByIdAndUpdate.mockResolvedValue({ ...sourceWallet, balance: 950000 });
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
    // Kiểm tra Wallet.findByIdAndUpdate được gọi với $inc: { balance: -50000 }
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
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

    Wallet.findByIdAndUpdate
      .mockResolvedValueOnce({ ...sourceWallet, balance: 1500000 })
      .mockResolvedValueOnce({ ...destWallet, balance: 1000000 });

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
    expect(Wallet.findByIdAndUpdate).toHaveBeenNthCalledWith(
      1,
      WALLET_ID,
      { $inc: { balance: -500000 } },
      { new: true }
    );
    expect(Wallet.findByIdAndUpdate).toHaveBeenNthCalledWith(
      2,
      DEST_WALLET_ID,
      { $inc: { balance: 500000 } },
      { new: true }
    );
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

    const res = mockRes();
    await ctrl.update(
      mockReq({
        params: { id: String(oldTx._id) },
        body: { amount: 80000 },
      }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(200);
    // 1 lần hoàn tác (+50k) và 1 lần áp dụng (-80k) trên cùng ví, hoặc gộp delta (-30k)
    // Kiểm tra tổng delta áp dụng lên WALLET_ID là -30000
    const calls = Wallet.findByIdAndUpdate.mock.calls.filter((c) => c[0] === WALLET_ID);
    const totalDelta = calls.reduce((sum, c) => sum + c[1].$inc.balance, 0);
    expect(totalDelta).toBe(-30000);
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
    // NEW_WALLET_ID mới phải bị trừ -50k
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      NEW_WALLET_ID,
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
    Wallet.findByIdAndUpdate.mockResolvedValue(makeWallet());

    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: String(tx._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
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

    const res = mockRes();
    await ctrl.remove(mockReq({ params: { id: String(tx._id) } }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      WALLET_ID,
      { $inc: { balance: 300000 } },
      { new: true }
    );
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      DEST_WALLET_ID,
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

