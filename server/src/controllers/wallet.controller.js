const mongoose = require('mongoose');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { validateNoteForCategory } = require('../utils/categoryRules');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

const WALLET_TYPES = ['cash', 'bank', 'credit_card', 'savings', 'investment'];
const INITIAL_BALANCE_NOTE = 'Số dư ban đầu';
const INITIAL_BALANCE_CATEGORY = 'Khác (Thu)';

// Danh mục thu cho phép chọn khi nạp tiền (mặc định: Lương)
const TOPUP_CATEGORY_NAMES = ['Lương', 'Thưởng', 'Công việc phụ', 'Vay mượn', 'Đầu tư', 'Kinh doanh', 'Khác (Thu)'];
const DEFAULT_TOPUP_CATEGORY = 'Lương';
const TOPUP_MAX_AMOUNT = 100000000;
const IDEMPOTENCY_KEY_MAX = 100;

const fail = (res, status, message) => res.status(status).json({ success: false, message });

/**
 * Chuyển giá trị balance về số hữu hạn. Trả về null nếu không hợp lệ.
 * Chỉ nhận number hoặc chuỗi số (không rỗng), từ chối NaN/Infinity/boolean/null.
 */
const parseBalance = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

// Ví thường luôn >= 0. Riêng ví credit_card được phép âm (âm = dư nợ).
const canBeNegative = (type) => type === 'credit_card';

/**
 * GET /api/wallets - Lấy danh sách ví của người dùng
 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    let wallets = await Wallet.find({ userId, isArchived: { $ne: true } }).sort({ createdAt: 1 });

    // Nếu user chưa có ví nào (ví dụ đăng ký trước đó), tự động tạo 1 ví tiền mặt mặc định
    if (wallets.length === 0) {
      const defaultWallet = await Wallet.create({
        userId,
        name: 'Ví tiền mặt',
        type: 'cash',
        balance: 0,
        currency: 'VND',
      });
      wallets = [defaultWallet];
    }

    return res.json({ success: true, data: wallets });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/wallets/default - Lấy ví mặc định đầu tiên
 */
exports.getDefault = async (req, res) => {
  try {
    const userId = req.user.id;
    let wallet = await Wallet.findOne({ userId, isArchived: { $ne: true } }).sort({ createdAt: 1 });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        name: 'Ví tiền mặt',
        type: 'cash',
        balance: 0,
        currency: 'VND',
      });
    }

    return res.json({ success: true, data: wallet });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * POST /api/wallets - Tạo ví mới
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, type, balance, currency, accountNumber, bankName } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return fail(res, 400, 'Tên ví là bắt buộc.');
    }

    const walletType = type === undefined ? 'cash' : type;
    if (!WALLET_TYPES.includes(walletType)) {
      return fail(res, 400, 'Loại ví không hợp lệ.');
    }

    let initialBalance = 0;
    if (balance !== undefined && balance !== null && balance !== '') {
      initialBalance = parseBalance(balance);
      if (initialBalance === null) return fail(res, 400, 'Số dư phải là một số hợp lệ.');
    }
    if (initialBalance < 0 && !canBeNegative(walletType)) {
      return fail(res, 400, 'Số dư không được âm.');
    }

    const wallet = await Wallet.create({
      userId,
      name: name.trim(),
      type: walletType,
      balance: initialBalance,
      currency: currency || 'VND',
      accountNumber: accountNumber ? String(accountNumber).trim() : null,
      bankName: bankName ? String(bankName).trim() : null,
    });

    // Ghi nhận số dư ban đầu thành giao dịch thu để sổ sách khớp.
    // Ví credit_card có số dư âm ban đầu chỉ là dư nợ khởi điểm, không tạo giao dịch.
    if (initialBalance > 0) {
      try {
        const category = await Category.findOne({
          userId: null,
          isDefault: true,
          type: 'income',
          name: INITIAL_BALANCE_CATEGORY,
        });
        if (category) {
          await Transaction.create({
            userId,
            walletId: wallet._id,
            categoryId: category._id,
            amount: initialBalance,
            type: 'income',
            note: INITIAL_BALANCE_NOTE,
            transactionDate: new Date(),
          });
        }
      } catch (err) {
        // Không để ví "mồ côi" số dư mà thiếu giao dịch: hoàn tác việc tạo ví
        await Wallet.deleteOne({ _id: wallet._id });
        throw err;
      }
    }

    return res.status(201).json({ success: true, message: 'Tạo ví thành công!', data: wallet });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/wallets/:id - Chi tiết một ví
 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID ví không hợp lệ.');

    const wallet = await Wallet.findOne({ _id: id, userId, isArchived: { $ne: true } });
    if (!wallet) return fail(res, 404, 'Không tìm thấy ví.');

    return res.json({ success: true, data: wallet });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * PATCH /api/wallets/:id - Cập nhật ví
 * Cho phép sửa trực tiếp `balance` để đối soát với thực tế (không tạo giao dịch thu/chi).
 */
exports.update = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID ví không hợp lệ.');

    const wallet = await Wallet.findOne({ _id: id, userId, isArchived: { $ne: true } });
    if (!wallet) return fail(res, 404, 'Không tìm thấy ví.');

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return fail(res, 400, 'Tên ví là bắt buộc.');
      }
      updates.name = body.name.trim();
    }

    let nextType = wallet.type;
    if (body.type !== undefined) {
      if (!WALLET_TYPES.includes(body.type)) return fail(res, 400, 'Loại ví không hợp lệ.');
      nextType = body.type;
      updates.type = body.type;
    }

    let nextBalance = wallet.balance;
    if (body.balance !== undefined) {
      const parsed = parseBalance(body.balance);
      if (parsed === null) return fail(res, 400, 'Số dư phải là một số hợp lệ.');
      nextBalance = parsed;
    }

    // Kiểm tra số dư theo loại ví sau khi cập nhật (gồm cả trường hợp đổi type)
    if (nextBalance < 0 && !canBeNegative(nextType)) {
      const message =
        body.balance === undefined
          ? 'Ví đang âm, hãy đưa số dư về từ 0 trở lên trước khi đổi loại ví.'
          : 'Số dư không được âm.';
      return fail(res, 400, message);
    }
    if (body.balance !== undefined && nextBalance !== wallet.balance) {
      updates.balance = nextBalance;
      updates.lastManualAdjustment = { from: wallet.balance, to: nextBalance, at: new Date() };
    }

    if (body.bankName !== undefined) {
      updates.bankName = body.bankName ? String(body.bankName).trim() : null;
    }
    if (body.accountNumber !== undefined) {
      updates.accountNumber = body.accountNumber ? String(body.accountNumber).trim() : null;
    }
    if (body.isExcludedFromNetWorth !== undefined) {
      if (typeof body.isExcludedFromNetWorth !== 'boolean') {
        return fail(res, 400, 'isExcludedFromNetWorth phải là true hoặc false.');
      }
      updates.isExcludedFromNetWorth = body.isExcludedFromNetWorth;
    }

    if (Object.keys(updates).length === 0) {
      return fail(res, 400, 'Không có thông tin nào để cập nhật.');
    }

    const updated = await Wallet.findOneAndUpdate(
      { _id: id, userId, isArchived: { $ne: true } },
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!updated) return fail(res, 404, 'Không tìm thấy ví.');

    return res.json({ success: true, message: 'Cập nhật ví thành công!', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * DELETE /api/wallets/:id - Lưu trữ (soft delete) ví
 * Không cho phép lưu trữ ví hoạt động cuối cùng.
 */
exports.remove = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID ví không hợp lệ.');

    const wallet = await Wallet.findOne({ _id: id, userId, isArchived: { $ne: true } });
    if (!wallet) return fail(res, 404, 'Không tìm thấy ví.');

    const activeCount = await Wallet.countDocuments({ userId, isArchived: { $ne: true } });
    if (activeCount <= 1) {
      return fail(res, 400, 'Không thể xóa ví cuối cùng. Hãy tạo ví khác trước.');
    }

    await Wallet.updateOne({ _id: id, userId }, { $set: { isArchived: true } });
    return res.json({ success: true, message: 'Đã xóa ví.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * POST /api/wallets/:id/topup - Nạp tiền vào ví (mô phỏng)
 * Body: { amount, categoryId?, note?, idempotencyKey? }
 *  - categoryId mặc định "Lương"; chỉ nhận danh mục thu trong TOPUP_CATEGORY_NAMES
 *  - Chọn "Khác" thì note bắt buộc
 *  - idempotencyKey: gửi lại cùng khóa thì không nạp lần 2, trả lại kết quả cũ
 * Nạp vào ví credit_card nghĩa là trả bớt dư nợ.
 */
exports.topup = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID ví không hợp lệ.');

    const body = req.body || {};
    const amount = parseBalance(body.amount);
    if (amount === null || amount <= 0) return fail(res, 400, 'Số tiền nạp phải là số lớn hơn 0.');
    if (amount > TOPUP_MAX_AMOUNT) {
      return fail(res, 400, `Số tiền nạp tối đa mỗi lần là ${TOPUP_MAX_AMOUNT.toLocaleString('vi-VN')} đ.`);
    }

    let idempotencyKey;
    if (body.idempotencyKey !== undefined && body.idempotencyKey !== null) {
      if (
        typeof body.idempotencyKey !== 'string' ||
        !body.idempotencyKey.trim() ||
        body.idempotencyKey.length > IDEMPOTENCY_KEY_MAX
      ) {
        return fail(res, 400, 'idempotencyKey không hợp lệ.');
      }
      idempotencyKey = body.idempotencyKey.trim();
    }

    // Gửi lại cùng khóa: trả kết quả cũ, không nạp lần nữa
    const replay = async () => {
      const existing = await Transaction.findOne({ userId, idempotencyKey });
      if (!existing) return null;
      if (String(existing.walletId) !== String(id)) {
        fail(res, 409, 'idempotencyKey đã được dùng cho một ví khác.');
        return true;
      }
      const current = await Wallet.findOne({ _id: id, userId });
      res.json({
        success: true,
        message: 'Giao dịch nạp tiền này đã được ghi nhận trước đó.',
        idempotent: true,
        data: { wallet: current, transaction: existing },
      });
      return true;
    };
    if (idempotencyKey && (await replay())) return;

    const wallet = await Wallet.findOne({ _id: id, userId, isArchived: { $ne: true } });
    if (!wallet) return fail(res, 404, 'Không tìm thấy ví.');

    // Danh mục: mặc định "Lương"; chỉ nhận danh mục thu mặc định trong danh sách cho phép
    let category;
    if (body.categoryId !== undefined && body.categoryId !== null && body.categoryId !== '') {
      if (typeof body.categoryId !== 'string' || !isValidId(body.categoryId)) {
        return fail(res, 400, 'ID danh mục không hợp lệ.');
      }
      category = await Category.findOne({
        _id: body.categoryId,
        userId: null,
        isDefault: true,
        type: 'income',
        isDeleted: { $ne: true },
      });
      if (!category || !TOPUP_CATEGORY_NAMES.includes(category.name)) {
        return fail(res, 400, 'Danh mục không hợp lệ cho việc nạp tiền.');
      }
    } else {
      category = await Category.findOne({
        userId: null,
        isDefault: true,
        type: 'income',
        name: DEFAULT_TOPUP_CATEGORY,
      });
      if (!category) return fail(res, 500, 'Chưa có danh mục mặc định "Lương". Hãy chạy seed danh mục.');
    }

    const note = typeof body.note === 'string' ? body.note.trim() : '';
    const noteError = validateNoteForCategory(category, note);
    if (noteError) return fail(res, 400, noteError);

    // Cộng số dư nguyên tử
    const updatedWallet = await Wallet.findOneAndUpdate(
      { _id: id, userId, isArchived: { $ne: true } },
      { $inc: { balance: amount } },
      { new: true }
    );
    if (!updatedWallet) return fail(res, 404, 'Không tìm thấy ví.');

    // Ghi giao dịch thu; lỗi thì hoàn tác số dư
    let transaction;
    try {
      transaction = await Transaction.create({
        userId,
        walletId: wallet._id,
        categoryId: category._id,
        amount,
        type: 'income',
        note,
        transactionDate: new Date(),
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
    } catch (err) {
      await Wallet.findByIdAndUpdate(wallet._id, { $inc: { balance: -amount } }, { new: true });
      // Hai request cùng khóa chạy song song: request đến sau trả kết quả của request trước
      if (err && err.code === 11000 && idempotencyKey && (await replay())) return;
      throw err;
    }

    return res.status(201).json({
      success: true,
      message: 'Nạp tiền thành công!',
      data: { wallet: updatedWallet, transaction },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
