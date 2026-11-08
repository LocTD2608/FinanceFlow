const mongoose = require('mongoose');

jest.mock('../src/models/Wallet', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
  updateOne: jest.fn(),
}));

jest.mock('../src/models/Transaction', () => ({
  create: jest.fn(),
}));

jest.mock('../src/models/Category', () => ({
  findOne: jest.fn(),
}));

const Wallet = require('../src/models/Wallet');
const walletCtrl = require('../src/controllers/wallet.controller');

const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();
const WALLET_ID = newId();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockReq = (body = {}, params = { id: WALLET_ID }) => ({
  user: { id: USER_ID },
  params,
  query: {},
  body,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Wallet Controller - Account Number & CRUD', () => {
  test('Tạo ví không truyền STK: tự động sinh STK 10 chữ số', async () => {
    // Mock check trùng trong generateAccountNumber -> null
    Wallet.findOne.mockReturnValue({
      session: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });
    Wallet.create.mockImplementation((doc) => Promise.resolve({ _id: WALLET_ID, ...doc }));

    const res = mockRes();
    await walletCtrl.create(mockReq({ name: 'Ví tiết kiệm', type: 'savings' }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    const createdCall = Wallet.create.mock.calls[0][0];
    expect(createdCall.accountNumber).toMatch(/^\d{10}$/);
  });

  test('Tạo ví truyền STK không đúng 10 chữ số -> 400', async () => {
    const res = mockRes();
    await walletCtrl.create(mockReq({ name: 'Ví ngân hàng', type: 'bank', accountNumber: '123' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain('10 chữ số');
  });

  test('Tạo ví truyền STK đã tồn tại -> 409', async () => {
    Wallet.findOne.mockResolvedValue({ _id: 'other_wallet' });

    const res = mockRes();
    await walletCtrl.create(mockReq({ name: 'Ví ngân hàng', type: 'bank', accountNumber: '1234567890' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].message).toContain('đã tồn tại');
  });

  test('Cập nhật ví với currency hợp lệ', async () => {
    Wallet.findOne.mockResolvedValue({ _id: WALLET_ID, userId: USER_ID, balance: 100000, type: 'cash' });
    Wallet.findOneAndUpdate.mockResolvedValue({ _id: WALLET_ID, currency: 'USD' });

    const res = mockRes();
    await walletCtrl.update(mockReq({ currency: 'USD' }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('Cập nhật ví với currency không hợp lệ -> 400', async () => {
    Wallet.findOne.mockResolvedValue({ _id: WALLET_ID, userId: USER_ID, balance: 100000, type: 'cash' });

    const res = mockRes();
    await walletCtrl.update(mockReq({ currency: 'INVALID' }), res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
