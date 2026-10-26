const mongoose = require('mongoose');

jest.mock('../src/models/Budget', () => ({
  find: jest.fn(),
  findById: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

jest.mock('../src/models/Wallet', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn(),
}));

jest.mock('../src/models/Transaction', () => ({
  create: jest.fn(),
}));

jest.mock('../src/models/Category', () => ({
  findOne: jest.fn(),
}));

const Budget = require('../src/models/Budget');
const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');
const Category = require('../src/models/Category');
const budgetCtrl = require('../src/controllers/budget.controller');
const walletCtrl = require('../src/controllers/wallet.controller');

const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();
const CAT_ID = newId();

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
    populate: () => q,
    lean: () => Promise.resolve(value),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return q;
};

describe('Wallet Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('list creates default wallet if none exists', async () => {
    Wallet.find.mockReturnValue({
      sort: () => Promise.resolve([]),
    });
    Wallet.create.mockResolvedValue({
      _id: 'w1',
      name: 'Ví tiền mặt',
      balance: 0,
    });

    const req = mockReq();
    const res = mockRes();

    await walletCtrl.list(req, res);

    expect(Wallet.create).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });
});

describe('Wallet Controller - create (số dư)', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  test.each([
    ['số âm', -100],
    ['chuỗi không phải số', 'abc'],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['boolean', true],
  ])('ví thường từ chối balance %s', async (_label, balance) => {
    const res = mockRes();
    await walletCtrl.create(mockReq({ body: { name: 'Ví A', type: 'cash', balance } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Wallet.create).not.toHaveBeenCalled();
  });

  test('từ chối loại ví không hợp lệ', async () => {
    const res = mockRes();
    await walletCtrl.create(mockReq({ body: { name: 'Ví A', type: 'crypto' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ví credit_card được phép số dư âm và không tạo giao dịch', async () => {
    Wallet.create.mockResolvedValue({ _id: 'w1', balance: -500000, type: 'credit_card' });
    const res = mockRes();

    await walletCtrl.create(
      mockReq({ body: { name: 'Thẻ VISA', type: 'credit_card', balance: -500000 } }),
      res
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Wallet.create).toHaveBeenCalledWith(expect.objectContaining({ balance: -500000 }));
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('không truyền balance thì mặc định 0 và không tạo giao dịch', async () => {
    Wallet.create.mockResolvedValue({ _id: 'w1', balance: 0 });
    const res = mockRes();

    await walletCtrl.create(mockReq({ body: { name: 'Ví A' } }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Wallet.create).toHaveBeenCalledWith(expect.objectContaining({ balance: 0, type: 'cash' }));
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('balance > 0 thì ghi giao dịch thu "Số dư ban đầu"', async () => {
    Wallet.create.mockResolvedValue({ _id: 'w1', balance: 2000000 });
    Category.findOne.mockResolvedValue({ _id: CAT_ID, name: 'Khác (Thu)' });
    Transaction.create.mockResolvedValue({ _id: 't1' });
    const res = mockRes();

    await walletCtrl.create(mockReq({ body: { name: 'Ví A', type: 'bank', balance: '2000000' } }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', amount: 2000000, note: 'Số dư ban đầu', walletId: 'w1' })
    );
  });

  test('lỗi khi ghi giao dịch ban đầu thì hoàn tác tạo ví', async () => {
    Wallet.create.mockResolvedValue({ _id: 'w1', balance: 100 });
    Category.findOne.mockResolvedValue({ _id: CAT_ID });
    Transaction.create.mockRejectedValue(new Error('db lỗi'));
    Wallet.deleteOne.mockResolvedValue({});
    const res = mockRes();

    await walletCtrl.create(mockReq({ body: { name: 'Ví A', balance: 100 } }), res);

    expect(Wallet.deleteOne).toHaveBeenCalledWith({ _id: 'w1' });
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe('Wallet Controller - getById', () => {
  afterEach(() => jest.resetAllMocks());

  test('ID không hợp lệ trả 400', async () => {
    const res = mockRes();
    await walletCtrl.getById(mockReq({ params: { id: 'xyz' } }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ví của user khác (không tìm thấy theo userId) trả 404', async () => {
    Wallet.findOne.mockResolvedValue(null);
    const res = mockRes();
    const id = newId();

    await walletCtrl.getById(mockReq({ params: { id } }), res);

    expect(Wallet.findOne).toHaveBeenCalledWith(expect.objectContaining({ _id: id, userId: USER_ID }));
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('trả về ví khi hợp lệ', async () => {
    Wallet.findOne.mockResolvedValue({ _id: 'w1', name: 'Ví A' });
    const res = mockRes();

    await walletCtrl.getById(mockReq({ params: { id: newId() } }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('Wallet Controller - update', () => {
  afterEach(() => jest.resetAllMocks());

  const walletDoc = (over = {}) => ({ _id: 'w1', name: 'Ví A', type: 'cash', balance: 100000, ...over });

  test('sửa balance hợp lệ: lưu số dư mới + lưu vết, không tạo giao dịch', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc());
    Wallet.findOneAndUpdate.mockResolvedValue(walletDoc({ balance: 250000 }));
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { balance: 250000 } }), res);

    const [, update] = Wallet.findOneAndUpdate.mock.calls[0];
    expect(update.$set.balance).toBe(250000);
    expect(update.$set.lastManualAdjustment).toEqual(expect.objectContaining({ from: 100000, to: 250000 }));
    expect(Transaction.create).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('cho phép sửa balance về 0', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc());
    Wallet.findOneAndUpdate.mockResolvedValue(walletDoc({ balance: 0 }));
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { balance: 0 } }), res);

    expect(Wallet.findOneAndUpdate.mock.calls[0][1].$set.balance).toBe(0);
  });

  test('từ chối balance âm ở ví thường', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc());
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { balance: -1 } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('từ chối balance không phải số', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc());
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { balance: 'abc' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ví credit_card được sửa balance âm', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc({ type: 'credit_card', balance: 0 }));
    Wallet.findOneAndUpdate.mockResolvedValue(walletDoc({ type: 'credit_card', balance: -300000 }));
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { balance: -300000 } }), res);

    expect(Wallet.findOneAndUpdate.mock.calls[0][1].$set.balance).toBe(-300000);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('đổi type từ credit_card sang loại khác khi đang âm bị chặn', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc({ type: 'credit_card', balance: -300000 }));
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { type: 'cash' } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('đổi type sang cash kèm sửa balance về >= 0 thì được', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc({ type: 'credit_card', balance: -300000 }));
    Wallet.findOneAndUpdate.mockResolvedValue(walletDoc({ type: 'cash', balance: 0 }));
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { type: 'cash', balance: 0 } }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('sửa tên/ngân hàng mà không động tới balance thì không ghi lastManualAdjustment', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc());
    Wallet.findOneAndUpdate.mockResolvedValue(walletDoc({ name: 'Ví B' }));
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { name: ' Ví B ', bankName: 'MB' } }), res);

    const set = Wallet.findOneAndUpdate.mock.calls[0][1].$set;
    expect(set.name).toBe('Ví B');
    expect(set.bankName).toBe('MB');
    expect(set.balance).toBeUndefined();
    expect(set.lastManualAdjustment).toBeUndefined();
  });

  test('tên rỗng và body rỗng bị từ chối', async () => {
    Wallet.findOne.mockResolvedValue(walletDoc());
    const res1 = mockRes();
    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { name: '  ' } }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await walletCtrl.update(mockReq({ params: { id: newId() }, body: {} }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  test('ví không thuộc user trả 404', async () => {
    Wallet.findOne.mockResolvedValue(null);
    const res = mockRes();

    await walletCtrl.update(mockReq({ params: { id: newId() }, body: { name: 'X' } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Wallet Controller - remove', () => {
  afterEach(() => jest.resetAllMocks());

  test('không cho xóa ví hoạt động cuối cùng', async () => {
    Wallet.findOne.mockResolvedValue({ _id: 'w1' });
    Wallet.countDocuments.mockResolvedValue(1);
    const res = mockRes();

    await walletCtrl.remove(mockReq({ params: { id: newId() } }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(Wallet.updateOne).not.toHaveBeenCalled();
  });

  test('archive mềm khi còn ví khác', async () => {
    Wallet.findOne.mockResolvedValue({ _id: 'w1' });
    Wallet.countDocuments.mockResolvedValue(2);
    Wallet.updateOne.mockResolvedValue({});
    const res = mockRes();

    await walletCtrl.remove(mockReq({ params: { id: newId() } }), res);

    expect(Wallet.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID }),
      { $set: { isArchived: true } }
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('ví không tồn tại trả 404', async () => {
    Wallet.findOne.mockResolvedValue(null);
    const res = mockRes();

    await walletCtrl.remove(mockReq({ params: { id: newId() } }), res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('Budget Controller', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('create validates amount >= 0', async () => {
    const req = mockReq({ body: { limitAmount: -100 } });
    const res = mockRes();

    await budgetCtrl.create(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('create creates budget successfully', async () => {
    Category.findOne.mockResolvedValue({ _id: CAT_ID, name: 'Ăn uống' });
    Budget.create.mockResolvedValue({ _id: 'b1', limitAmount: 3500000 });
    Budget.findById.mockReturnValue({
      populate: () => Promise.resolve({ _id: 'b1', limitAmount: 3500000, categoryId: { name: 'Ăn uống' } }),
    });

    const req = mockReq({ body: { limitAmount: 3500000, month: '2026-10', categoryName: 'Ăn uống' } });
    const res = mockRes();

    await budgetCtrl.create(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Kích hoạt ngân sách thành công!' })
    );
  });

  test('list returns user budgets', async () => {
    Budget.find.mockReturnValue(queryChain([{ _id: 'b1', limitAmount: 3500000 }]));

    const req = mockReq();
    const res = mockRes();

    await budgetCtrl.list(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });
});
