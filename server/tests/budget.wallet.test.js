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
}));

jest.mock('../src/models/Category', () => ({
  findOne: jest.fn(),
}));

const Budget = require('../src/models/Budget');
const Wallet = require('../src/models/Wallet');
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
