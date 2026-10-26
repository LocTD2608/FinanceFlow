const mongoose = require('mongoose');

jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../src/models/Transaction', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock('../src/models/Category', () => ({
  findOne: jest.fn(),
}));

const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');
const Category = require('../src/models/Category');
const walletCtrl = require('../src/controllers/wallet.controller');

const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();
const WALLET_ID = newId();
const CAT_ID = newId();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockReq = (body = {}, params = { id: WALLET_ID }) => ({ user: { id: USER_ID }, params, query: {}, body });
const body = (res) => res.json.mock.calls[0][0];

const wallet = (over = {}) => ({ _id: WALLET_ID, userId: USER_ID, name: 'Ví A', type: 'cash', balance: 100000, ...over });
const incomeCat = (name, over = {}) => ({ _id: CAT_ID, userId: null, isDefault: true, type: 'income', name, ...over });

beforeEach(() => {
  jest.resetAllMocks();
});

describe('POST /wallets/:id/topup', () => {
  const happy = (catName = 'Lương') => {
    Wallet.findOne.mockResolvedValue(wallet());
    Category.findOne.mockResolvedValue(incomeCat(catName));
    Wallet.findOneAndUpdate.mockResolvedValue(wallet({ balance: 600000 }));
    Transaction.create.mockResolvedValue({ _id: 't1', amount: 500000 });
  };

  test('nạp hợp lệ: tăng số dư, ghi giao dịch thu danh mục Lương mặc định', async () => {
    happy();
    const res = mockRes();

    await walletCtrl.topup(mockReq({ amount: 500000 }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: WALLET_ID, userId: USER_ID }),
      { $inc: { balance: 500000 } },
      { new: true }
    );
    // Không truyền categoryId -> tìm danh mục mặc định "Lương"
    expect(Category.findOne).toHaveBeenCalledWith(expect.objectContaining({ name: 'Lương', type: 'income' }));
    expect(Transaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'income', amount: 500000, categoryId: CAT_ID, walletId: WALLET_ID })
    );
    expect(body(res).data.wallet.balance).toBe(600000);
  });

  test.each([
    ['0', 0],
    ['số âm', -1],
    ['chuỗi không phải số', 'abc'],
    ['NaN', NaN],
    ['thiếu amount', undefined],
  ])('từ chối amount %s', async (_label, amount) => {
    const res = mockRes();
    await walletCtrl.topup(mockReq({ amount }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('từ chối amount vượt trần 100.000.000', async () => {
    const res = mockRes();
    await walletCtrl.topup(mockReq({ amount: 100000001 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('chấp nhận đúng trần 100.000.000', async () => {
    happy();
    const res = mockRes();
    await walletCtrl.topup(mockReq({ amount: 100000000 }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('ID ví không hợp lệ -> 400; ví không thuộc user -> 404', async () => {
    const res1 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000 }, { id: 'xyz' }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    Wallet.findOne.mockResolvedValue(null);
    const res2 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000 }), res2);
    expect(res2.status).toHaveBeenCalledWith(404);
  });

  test.each(['Thưởng', 'Công việc phụ', 'Vay mượn', 'Đầu tư', 'Kinh doanh'])(
    'danh mục %s để trống ghi chú vẫn được',
    async (name) => {
      happy(name);
      const res = mockRes();
      await walletCtrl.topup(mockReq({ amount: 1000, categoryId: CAT_ID }), res);
      expect(res.status).toHaveBeenCalledWith(201);
    }
  );

  test('"Khác" thiếu ghi chú -> 400, không cộng tiền', async () => {
    happy('Khác (Thu)');
    const res = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, categoryId: CAT_ID }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(body(res).message).toMatch(/ghi chú/i);
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('"Khác" ghi chú toàn khoảng trắng hoặc quá 50 ký tự -> 400', async () => {
    happy('Khác (Thu)');
    const res1 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, categoryId: CAT_ID, note: '   ' }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, categoryId: CAT_ID, note: 'a'.repeat(51) }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });

  test('"Khác" có ghi chú -> 201 và lưu ghi chú đã trim', async () => {
    happy('Khác (Thu)');
    const res = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, categoryId: CAT_ID, note: '  Bán đồ cũ ' }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ note: 'Bán đồ cũ' }));
  });

  test('từ chối danh mục chi hoặc danh mục thu ngoài danh sách nạp tiền', async () => {
    Wallet.findOne.mockResolvedValue(wallet());

    Category.findOne.mockResolvedValue(null); // danh mục chi không khớp type: 'income'
    const res1 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, categoryId: CAT_ID }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    Category.findOne.mockResolvedValue(incomeCat('Cho vay thu hồi cũ'));
    const res2 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, categoryId: CAT_ID }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
  });

  test('categoryId sai định dạng -> 400', async () => {
    Wallet.findOne.mockResolvedValue(wallet());
    const res = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, categoryId: 'abc' }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('ghi giao dịch lỗi thì hoàn tác số dư đã cộng', async () => {
    happy();
    Transaction.create.mockRejectedValue(new Error('db lỗi'));
    Wallet.findByIdAndUpdate.mockResolvedValue({});
    const res = mockRes();

    await walletCtrl.topup(mockReq({ amount: 500000 }), res);

    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(WALLET_ID, { $inc: { balance: -500000 } }, { new: true });
    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('nạp vào ví credit_card (trả bớt dư nợ) vẫn hợp lệ', async () => {
    Wallet.findOne.mockResolvedValue(wallet({ type: 'credit_card', balance: -300000 }));
    Category.findOne.mockResolvedValue(incomeCat('Lương'));
    Wallet.findOneAndUpdate.mockResolvedValue(wallet({ type: 'credit_card', balance: -100000 }));
    Transaction.create.mockResolvedValue({ _id: 't1' });
    const res = mockRes();

    await walletCtrl.topup(mockReq({ amount: 200000 }), res);

    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('POST /wallets/:id/topup - idempotency', () => {
  test('gửi lại cùng khóa: trả kết quả cũ, không cộng tiền lần 2', async () => {
    Transaction.findOne.mockResolvedValue({ _id: 't1', walletId: WALLET_ID, amount: 500000 });
    Wallet.findOne.mockResolvedValue(wallet({ balance: 600000 }));
    const res = mockRes();

    await walletCtrl.topup(mockReq({ amount: 500000, idempotencyKey: 'abc-123' }), res);

    expect(body(res)).toMatchObject({ success: true, idempotent: true });
    expect(Wallet.findOneAndUpdate).not.toHaveBeenCalled();
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('khóa đã dùng cho ví khác -> 409', async () => {
    Transaction.findOne.mockResolvedValue({ _id: 't1', walletId: newId() });
    const res = mockRes();

    await walletCtrl.topup(mockReq({ amount: 1000, idempotencyKey: 'abc' }), res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  test('khóa mới: lưu idempotencyKey vào giao dịch', async () => {
    Transaction.findOne.mockResolvedValue(null);
    Wallet.findOne.mockResolvedValue(wallet());
    Category.findOne.mockResolvedValue(incomeCat('Lương'));
    Wallet.findOneAndUpdate.mockResolvedValue(wallet({ balance: 101000 }));
    Transaction.create.mockResolvedValue({ _id: 't1' });
    const res = mockRes();

    await walletCtrl.topup(mockReq({ amount: 1000, idempotencyKey: ' key-1 ' }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: 'key-1' }));
  });

  test('hai request song song cùng khóa: bên đến sau bị trùng khóa -> hoàn tác và trả kết quả cũ', async () => {
    Transaction.findOne
      .mockResolvedValueOnce(null) // kiểm tra ban đầu: chưa có
      .mockResolvedValueOnce({ _id: 't1', walletId: WALLET_ID }); // sau khi trùng khóa: đã có
    Wallet.findOne.mockResolvedValue(wallet());
    Category.findOne.mockResolvedValue(incomeCat('Lương'));
    Wallet.findOneAndUpdate.mockResolvedValue(wallet({ balance: 101000 }));
    Transaction.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    Wallet.findByIdAndUpdate.mockResolvedValue({});
    const res = mockRes();

    await walletCtrl.topup(mockReq({ amount: 1000, idempotencyKey: 'dup-key' }), res);

    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(WALLET_ID, { $inc: { balance: -1000 } }, { new: true });
    expect(body(res)).toMatchObject({ success: true, idempotent: true });
  });

  test('idempotencyKey sai kiểu hoặc quá dài -> 400', async () => {
    const res1 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, idempotencyKey: 123 }), res1);
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await walletCtrl.topup(mockReq({ amount: 1000, idempotencyKey: 'x'.repeat(101) }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);
  });
});
