/**
 * Unit test cho API tạo giao dịch (controller). Model được mock, không cần MongoDB.
 */
const mongoose = require('mongoose');

jest.mock('../src/models/Category', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
  create: jest.fn(),
}));
jest.mock('../src/models/Transaction', () => ({ create: jest.fn(), aggregate: jest.fn() }));
jest.mock('../src/models/Budget', () => ({ findOne: jest.fn() }));

const Category = require('../src/models/Category');
const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');
const Budget = require('../src/models/Budget');
const ctrl = require('../src/controllers/transaction.controller');

const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();

// Query giả: hỗ trợ .sort().lean() và await trực tiếp
const query = (value) => {
  const q = {
    sort: () => q,
    lean: () => q,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const body = (res) => res.json.mock.calls[0][0];

const makeCategory = (o = {}) => ({
  _id: newId(),
  userId: USER_ID,
  name: 'Ăn uống',
  type: 'expense',
  isDefault: false,
  ...o,
});
const makeWallet = (o = {}) => ({ _id: newId(), userId: USER_ID, balance: 1000000, ...o });

const mockReq = (b = {}) => ({
  user: { id: USER_ID },
  body: { type: 'expense', categoryId: newId(), amount: 50000, ...b },
});

// Thiết lập "đường thành công" mặc định
const setupHappy = ({ category = makeCategory(), wallet = makeWallet(), newBalance } = {}) => {
  Category.findOne.mockReturnValue(query(category));
  Wallet.findOne.mockReturnValue(query(wallet));
  Wallet.findOneAndUpdate.mockResolvedValue({
    _id: wallet._id,
    balance: newBalance !== undefined ? newBalance : wallet.balance,
  });
  Transaction.create.mockImplementation(async (d) => ({ _id: newId(), ...d }));
  Budget.findOne.mockReturnValue(query(null));
  return { category, wallet };
};

beforeEach(() => {
  jest.resetAllMocks();
});

describe('validate đầu vào', () => {
  it.each([
    ['type sai', { type: 'transfer' }],
    ['amount <= 0', { amount: 0 }],
    ['amount âm', { amount: -5 }],
    ['amount là chuỗi', { amount: '100' }],
    ['categoryId sai định dạng', { categoryId: 'abc' }],
    ['walletId sai định dạng', { walletId: 'xyz' }],
    ['ngày không hợp lệ', { transactionDate: 'khong-phai-ngay' }],
  ])('%s -> 400', async (_name, override) => {
    Category.findOne.mockReturnValue(query(makeCategory()));
    const res = mockRes();
    await ctrl.create(mockReq(override), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('danh mục', () => {
  it('không tồn tại / của người khác / đã xóa -> 404', async () => {
    Category.findOne.mockReturnValue(query(null));
    const res = mockRes();
    await ctrl.create(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('loại danh mục không khớp type -> 400', async () => {
    Category.findOne.mockReturnValue(query(makeCategory({ type: 'income' })));
    const res = mockRes();
    await ctrl.create(mockReq({ type: 'expense' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('truy vấn chỉ lấy danh mục mặc định hoặc của user, chưa xóa', async () => {
    setupHappy();
    await ctrl.create(mockReq(), mockRes());
    const filter = Category.findOne.mock.calls[0][0];
    expect(filter.$or).toEqual([{ userId: null }, { userId: USER_ID }]);
    expect(filter.isDeleted).toEqual({ $ne: true });
  });

  describe('danh mục "Khác"', () => {
    const other = () => makeCategory({ userId: null, isDefault: true, name: 'Khác (Chi)' });

    it('thiếu ghi chú -> 400', async () => {
      Category.findOne.mockReturnValue(query(other()));
      const res = mockRes();
      await ctrl.create(mockReq(), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ghi chú chỉ có khoảng trắng -> 400', async () => {
      Category.findOne.mockReturnValue(query(other()));
      const res = mockRes();
      await ctrl.create(mockReq({ note: '    ' }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ghi chú quá 50 ký tự -> 400', async () => {
      Category.findOne.mockReturnValue(query(other()));
      const res = mockRes();
      await ctrl.create(mockReq({ note: 'a'.repeat(51) }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('ghi chú đúng 50 ký tự -> 201', async () => {
      setupHappy({ category: other() });
      const res = mockRes();
      await ctrl.create(mockReq({ note: 'a'.repeat(50) }), res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });

  it('danh mục thường không bắt buộc ghi chú', async () => {
    setupHappy();
    const res = mockRes();
    await ctrl.create(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ví', () => {
  it('walletId không thuộc user / đã archived -> 404', async () => {
    Category.findOne.mockReturnValue(query(makeCategory()));
    Wallet.findOne.mockReturnValue(query(null));
    const res = mockRes();
    await ctrl.create(mockReq({ walletId: newId() }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(Wallet.findOne.mock.calls[0][0]).toMatchObject({ userId: USER_ID, isArchived: false });
  });

  it('không gửi walletId -> dùng ví mặc định (chưa archived, không bị loại net worth)', async () => {
    const { wallet } = setupHappy();
    const res = mockRes();
    await ctrl.create(mockReq(), res);
    expect(Wallet.findOne.mock.calls[0][0]).toMatchObject({
      userId: USER_ID,
      isArchived: false,
      isExcludedFromNetWorth: false,
    });
    expect(Transaction.create.mock.calls[0][0].walletId).toBe(wallet._id);
  });

  it('chưa có ví -> tự tạo "Ví mặc định" số dư 0', async () => {
    Category.findOne.mockReturnValue(query(makeCategory({ type: 'income', name: 'Lương' })));
    Wallet.findOne.mockReturnValue(query(null));
    const created = makeWallet({ name: 'Ví mặc định', balance: 0 });
    Wallet.create.mockResolvedValue(created);
    Wallet.findOneAndUpdate.mockResolvedValue({ _id: created._id, balance: 100000 });
    Transaction.create.mockImplementation(async (d) => ({ _id: newId(), ...d }));
    Budget.findOne.mockReturnValue(query(null));

    const res = mockRes();
    await ctrl.create(mockReq({ type: 'income', amount: 100000, categoryId: newId() }), res);

    expect(Wallet.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, name: 'Ví mặc định', balance: 0 })
    );
  });
});

describe('số dư', () => {
  it('chi vượt số dư -> 400 kèm currentBalance, shortfall, không tạo giao dịch', async () => {
    Category.findOne.mockReturnValue(query(makeCategory()));
    const wallet = makeWallet({ balance: 30000 });
    Wallet.findOne.mockReturnValue(query(wallet));
    Wallet.findOneAndUpdate.mockResolvedValue(null); // không thỏa balance >= amount
    const res = mockRes();

    await ctrl.create(mockReq({ amount: 50000 }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res)).toMatchObject({
      code: 'INSUFFICIENT_BALANCE',
      currentBalance: 30000,
      shortfall: 20000,
    });
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  it('chi: trừ ví nguyên tử với điều kiện balance >= amount', async () => {
    setupHappy({ newBalance: 950000 });
    const res = mockRes();
    await ctrl.create(mockReq({ amount: 50000 }), res);

    const [filter, update] = Wallet.findOneAndUpdate.mock.calls[0];
    expect(filter.balance).toEqual({ $gte: 50000 });
    expect(update).toEqual({ $inc: { balance: -50000 } });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(body(res).wallet.balance).toBe(950000);
  });

  it('thu: cộng ví, không kiểm tra số dư', async () => {
    setupHappy({
      category: makeCategory({ type: 'income', name: 'Lương' }),
      newBalance: 1100000,
    });
    const res = mockRes();
    await ctrl.create(mockReq({ type: 'income', amount: 100000 }), res);

    const [filter, update] = Wallet.findOneAndUpdate.mock.calls[0];
    expect(filter.balance).toBeUndefined();
    expect(update).toEqual({ $inc: { balance: 100000 } });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('tạo giao dịch lỗi -> hoàn tác số dư và trả 500', async () => {
    const { wallet } = setupHappy();
    Transaction.create.mockRejectedValue(new Error('db lỗi'));
    const res = mockRes();

    await ctrl.create(mockReq({ amount: 50000 }), res);

    expect(Wallet.updateOne).toHaveBeenCalledWith(
      { _id: wallet._id },
      { $inc: { balance: 50000 } }
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('tạo thành công', () => {
  it('lưu đúng dữ liệu, trim ghi chú, trả 201', async () => {
    const { category, wallet } = setupHappy();
    const res = mockRes();
    await ctrl.create(
      mockReq({ amount: 85000, note: '  Ăn trưa  ', transactionDate: '2026-10-11T10:00:00+07:00' }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const created = Transaction.create.mock.calls[0][0];
    expect(created).toMatchObject({
      userId: USER_ID,
      walletId: wallet._id,
      categoryId: category._id,
      amount: 85000,
      type: 'expense',
      note: 'Ăn trưa',
    });
    expect(created.transactionDate.toISOString()).toBe('2026-10-11T03:00:00.000Z');
    expect(body(res).data.amount).toBe(85000);
    expect(body(res).budgetAlert).toBeUndefined();
  });
});

describe('cảnh báo ngân sách', () => {
  const setupBudget = (budget, spent) => {
    const ctx = setupHappy();
    Budget.findOne.mockReturnValue(query(budget));
    Transaction.aggregate.mockResolvedValue(spent === null ? [] : [{ _id: null, total: spent }]);
    return ctx;
  };
  const baseBudget = {
    limitAmount: 1000000,
    alertThreshold50: true,
    alertThreshold80: true,
    alertThreshold100: true,
  };

  it('chi làm vượt 100% -> có budgetAlert', async () => {
    const { category } = setupBudget(baseBudget, 1100000);
    const res = mockRes();
    await ctrl.create(mockReq({ amount: 200000 }), res);
    expect(body(res).budgetAlert).toMatchObject({
      categoryName: category.name,
      limitAmount: 1000000,
      spent: 1100000,
      percent: 110,
      threshold: 100,
    });
  });

  it('chi làm đạt mốc 80% -> cảnh báo mốc 80', async () => {
    setupBudget(baseBudget, 850000);
    const res = mockRes();
    await ctrl.create(mockReq({ amount: 100000 }), res);
    expect(body(res).budgetAlert.threshold).toBe(80);
  });

  it('chưa qua mốc nào -> không cảnh báo', async () => {
    setupBudget(baseBudget, 300000);
    const res = mockRes();
    await ctrl.create(mockReq({ amount: 50000 }), res);
    expect(body(res).budgetAlert).toBeUndefined();
  });

  it('đã qua mốc từ trước (không vừa vượt mốc) -> không lặp cảnh báo', async () => {
    setupBudget(baseBudget, 900000);
    const res = mockRes();
    await ctrl.create(mockReq({ amount: 10000 }), res);
    expect(body(res).budgetAlert).toBeUndefined();
  });

  it('cờ ngưỡng đang tắt -> không cảnh báo mốc đó', async () => {
    setupBudget({ ...baseBudget, alertThreshold100: false, alertThreshold80: false }, 1100000);
    const res = mockRes();
    await ctrl.create(mockReq({ amount: 200000 }), res);
    expect(body(res).budgetAlert).toBeUndefined();
  });

  it('không có ngân sách -> không cảnh báo', async () => {
    setupBudget(null, null);
    const res = mockRes();
    await ctrl.create(mockReq(), res);
    expect(body(res).budgetAlert).toBeUndefined();
  });

  it('giao dịch thu không kiểm tra ngân sách', async () => {
    setupHappy({ category: makeCategory({ type: 'income' }) });
    const res = mockRes();
    await ctrl.create(mockReq({ type: 'income' }), res);
    expect(Budget.findOne).not.toHaveBeenCalled();
  });

  it('lỗi khi tính ngân sách không làm hỏng giao dịch', async () => {
    setupHappy();
    Budget.findOne.mockImplementation(() => {
      throw new Error('budget lỗi');
    });
    const res = mockRes();
    await ctrl.create(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(body(res).budgetAlert).toBeUndefined();
  });
});
