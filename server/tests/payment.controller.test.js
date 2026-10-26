const mongoose = require('mongoose');

jest.mock('../src/models/Wallet', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('../src/models/Transaction', () => ({ create: jest.fn(), findById: jest.fn() }));
jest.mock('../src/models/Category', () => ({ findOne: jest.fn() }));
jest.mock('../src/models/User', () => ({ findById: jest.fn() }));
jest.mock('../src/models/PaymentIntent', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
}));
jest.mock('../src/services/mail.service', () => ({
  sendOtpEmail: jest.fn(),
  maskEmail: jest.fn(() => 'a***@gmail.com'),
}));

const Wallet = require('../src/models/Wallet');
const Transaction = require('../src/models/Transaction');
const Category = require('../src/models/Category');
const User = require('../src/models/User');
const PaymentIntent = require('../src/models/PaymentIntent');
const mail = require('../src/services/mail.service');
const ctrl = require('../src/controllers/payment.controller');

const newId = () => new mongoose.Types.ObjectId().toString();
const USER_ID = newId();
const WALLET_ID = newId();
const CAT_ID = newId();
const INTENT_ID = newId();

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const mockReq = (body = {}, params = {}) => ({ user: { id: USER_ID }, params, query: {}, body });
const out = (res) => res.json.mock.calls[0][0];

const wallet = (over = {}) => ({ _id: WALLET_ID, userId: USER_ID, type: 'cash', balance: 500000, ...over });
const cat = (over = {}) => ({ _id: CAT_ID, userId: null, isDefault: true, type: 'expense', name: 'Ăn uống', ...over });
const intent = (over = {}) => ({
  _id: INTENT_ID,
  userId: USER_ID,
  walletId: WALLET_ID,
  categoryId: CAT_ID,
  amount: 100000,
  note: '',
  attempts: 0,
  sendCount: 1,
  lastSentAt: new Date(Date.now() - 120000),
  expiresAt: new Date(Date.now() + 120000),
  status: 'pending',
  save: jest.fn().mockResolvedValue(),
  ...over,
});

let sentOtp;
beforeEach(() => {
  jest.resetAllMocks();
  mail.maskEmail.mockReturnValue('a***@gmail.com');
  sentOtp = null;
  mail.sendOtpEmail.mockImplementation(async (to, otp) => {
    sentOtp = otp;
  });
  User.findById.mockResolvedValue({ email: 'abc@gmail.com' });
});

describe('POST /payments/intent', () => {
  const happy = () => {
    Wallet.findOne.mockResolvedValue(wallet());
    Category.findOne.mockResolvedValue(cat());
    PaymentIntent.create.mockImplementation(async (d) => ({ _id: INTENT_ID, ...d }));
  };

  test('tạo intent, gửi mail, không trả OTP', async () => {
    happy();
    const res = mockRes();
    await ctrl.createIntent(mockReq({ walletId: WALLET_ID, categoryId: CAT_ID, amount: 100000 }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(sentOtp).toMatch(/^\d{6}$/);
    expect(JSON.stringify(out(res))).not.toContain(sentOtp);
    expect(out(res).data.email).toBe('a***@gmail.com');
    const saved = PaymentIntent.create.mock.calls[0][0];
    expect(saved.otpHash).toBeDefined();
    expect(saved.otpHash).not.toBe(sentOtp);
  });

  test('thiếu số dư: trả INSUFFICIENT_BALANCE, không gửi mail', async () => {
    Wallet.findOne.mockResolvedValue(wallet({ balance: 50000 }));
    Category.findOne.mockResolvedValue(cat());
    const res = mockRes();
    await ctrl.createIntent(mockReq({ walletId: WALLET_ID, categoryId: CAT_ID, amount: 100000 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(out(res).code).toBe('INSUFFICIENT_BALANCE');
    expect(out(res).shortfall).toBe(50000);
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
  });

  test('ví credit_card được âm', async () => {
    Wallet.findOne.mockResolvedValue(wallet({ type: 'credit_card', balance: 0 }));
    Category.findOne.mockResolvedValue(cat());
    PaymentIntent.create.mockImplementation(async (d) => ({ _id: INTENT_ID, ...d }));
    const res = mockRes();
    await ctrl.createIntent(mockReq({ walletId: WALLET_ID, categoryId: CAT_ID, amount: 100000 }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('danh mục Khác bắt buộc ghi chú', async () => {
    Wallet.findOne.mockResolvedValue(wallet());
    Category.findOne.mockResolvedValue(cat({ name: 'Khác (Chi)' }));
    const res = mockRes();
    await ctrl.createIntent(mockReq({ walletId: WALLET_ID, categoryId: CAT_ID, amount: 1000 }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
  });

  test('gửi mail lỗi: 502 và không tạo intent', async () => {
    happy();
    mail.sendOtpEmail.mockRejectedValue(new Error('smtp down'));
    const res = mockRes();
    await ctrl.createIntent(mockReq({ walletId: WALLET_ID, categoryId: CAT_ID, amount: 1000 }), res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(PaymentIntent.create).not.toHaveBeenCalled();
  });

  test.each([0, -5, 'abc', 200000000])('số tiền %p không hợp lệ', async (amount) => {
    const res = mockRes();
    await ctrl.createIntent(mockReq({ walletId: WALLET_ID, categoryId: CAT_ID, amount }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('POST /payments/intent/:id/resend', () => {
  test('gửi lại khi đủ 60s', async () => {
    const it = intent();
    PaymentIntent.findOne.mockResolvedValue(it);
    const res = mockRes();
    await ctrl.resendOtp(mockReq({}, { id: INTENT_ID }), res);
    expect(it.sendCount).toBe(2);
    expect(it.save).toHaveBeenCalled();
    expect(out(res).success).toBe(true);
  });

  test('chưa đủ 60s: 429', async () => {
    PaymentIntent.findOne.mockResolvedValue(intent({ lastSentAt: new Date() }));
    const res = mockRes();
    await ctrl.resendOtp(mockReq({}, { id: INTENT_ID }), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(mail.sendOtpEmail).not.toHaveBeenCalled();
  });

  test('quá 3 lần gửi: 429', async () => {
    PaymentIntent.findOne.mockResolvedValue(intent({ sendCount: 3 }));
    const res = mockRes();
    await ctrl.resendOtp(mockReq({}, { id: INTENT_ID }), res);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

describe('POST /payments/intent/:id/confirm', () => {
  const hash = (otp) => require('../src/controllers/payment.controller').hashOtp(otp);

  test('OTP đúng: trừ tiền, ghi giao dịch chi, hoàn tất', async () => {
    const it = intent({ otpHash: hash('123456') });
    PaymentIntent.findOne.mockResolvedValue(it);
    PaymentIntent.findOneAndUpdate
      .mockResolvedValueOnce({ ...it, attempts: 1 })
      .mockResolvedValueOnce({ ...it, status: 'processing' });
    Wallet.findOneAndUpdate.mockResolvedValue(wallet({ balance: 400000 }));
    Transaction.create.mockResolvedValue({ _id: 't1', amount: 100000 });
    const res = mockRes();
    await ctrl.confirmIntent(mockReq({ otp: '123456' }, { id: INTENT_ID }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(Transaction.create).toHaveBeenCalledWith(expect.objectContaining({ type: 'expense', amount: 100000 }));
    expect(PaymentIntent.updateOne).toHaveBeenCalledWith(
      { _id: INTENT_ID },
      expect.objectContaining({ status: 'completed' })
    );
  });

  test('OTP sai: 400 và còn số lần thử', async () => {
    const it = intent({ otpHash: hash('123456') });
    PaymentIntent.findOne.mockResolvedValue(it);
    PaymentIntent.findOneAndUpdate.mockResolvedValueOnce({ ...it, attempts: 1 });
    const res = mockRes();
    await ctrl.confirmIntent(mockReq({ otp: '000000' }, { id: INTENT_ID }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(out(res).code).toBe('OTP_INVALID');
    expect(out(res).attemptsLeft).toBe(4);
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('sai lần thứ 5: khóa intent', async () => {
    const it = intent({ otpHash: hash('123456') });
    PaymentIntent.findOne.mockResolvedValue(it);
    PaymentIntent.findOneAndUpdate.mockResolvedValueOnce({ ...it, attempts: 5 });
    const res = mockRes();
    await ctrl.confirmIntent(mockReq({ otp: '000000' }, { id: INTENT_ID }), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(PaymentIntent.updateOne).toHaveBeenCalledWith(expect.anything(), { status: 'failed' });
  });

  test('OTP hết hạn: đánh dấu expired', async () => {
    PaymentIntent.findOne.mockResolvedValue(intent({ expiresAt: new Date(Date.now() - 1000) }));
    const res = mockRes();
    await ctrl.confirmIntent(mockReq({ otp: '123456' }, { id: INTENT_ID }), res);
    expect(out(res).code).toBe('OTP_EXPIRED');
    expect(PaymentIntent.updateOne).toHaveBeenCalledWith(expect.anything(), { status: 'expired' });
  });

  test('đủ OTP nhưng ví thiếu tiền: INSUFFICIENT_BALANCE, mở lại intent', async () => {
    const it = intent({ otpHash: hash('123456') });
    PaymentIntent.findOne.mockResolvedValue(it);
    PaymentIntent.findOneAndUpdate
      .mockResolvedValueOnce({ ...it, attempts: 1 })
      .mockResolvedValueOnce({ ...it, status: 'processing' });
    Wallet.findOneAndUpdate.mockResolvedValue(null);
    Wallet.findById.mockResolvedValue(wallet({ balance: 10 }));
    const res = mockRes();
    await ctrl.confirmIntent(mockReq({ otp: '123456' }, { id: INTENT_ID }), res);
    expect(out(res).code).toBe('INSUFFICIENT_BALANCE');
    expect(Transaction.create).not.toHaveBeenCalled();
  });

  test('OTP không đúng định dạng: 400', async () => {
    PaymentIntent.findOne.mockResolvedValue(intent());
    const res = mockRes();
    await ctrl.confirmIntent(mockReq({ otp: 'abc' }, { id: INTENT_ID }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
