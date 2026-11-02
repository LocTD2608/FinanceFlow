const mongoose = require('mongoose');
const Goal = require('../models/Goal');
const GoalContribution = require('../models/GoalContribution');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const { runInTransaction } = require('../utils/dbTransaction');
const { insufficientBody } = require('../utils/walletBalance');

const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);
const fail = (res, status, message, extra = {}) =>
  res.status(status).json({ success: false, message, ...extra });
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * GET /api/goals?status=active|completed|cancelled
 * Danh sách mục tiêu của người dùng
 */
exports.list = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    const filter = { userId };
    if (status && ['active', 'completed', 'cancelled'].includes(status)) {
      filter.status = status;
    }

    const goals = await Goal.find(filter)
      .sort({ createdAt: -1 })
      .populate('targetWalletId', 'name type currency')
      .lean();

    const now = Date.now();
    const formatted = goals.map((g) => {
      const progressPercent =
        g.targetAmount > 0 ? round2(Math.min(100, (g.currentAmount / g.targetAmount) * 100)) : 0;
      const remaining = Math.max(0, g.targetAmount - g.currentAmount);

      let daysLeft = null;
      if (g.deadline) {
        const diffMs = new Date(g.deadline).getTime() - now;
        daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
      }

      return {
        ...g,
        progressPercent,
        remaining,
        daysLeft,
      };
    });

    return res.json({ success: true, data: formatted });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * POST /api/goals
 * Tạo mục tiêu tài chính mới
 */
exports.create = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, targetAmount, deadline, icon, color, targetWalletId } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return fail(res, 400, 'Tên mục tiêu là bắt buộc.');
    }

    const numericTarget = Number(targetAmount);
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      return fail(res, 400, 'Số tiền mục tiêu phải là số lớn hơn 0.');
    }

    if (targetWalletId) {
      if (!isValidId(targetWalletId)) return fail(res, 400, 'ID ví thụ hưởng không hợp lệ.');
      const w = await Wallet.findOne({ _id: targetWalletId, userId });
      if (!w) return fail(res, 404, 'Ví thụ hưởng không tồn tại.');
    }

    const goal = await Goal.create({
      userId,
      name: name.trim(),
      targetAmount: numericTarget,
      currentAmount: 0,
      deadline: deadline ? new Date(deadline) : null,
      icon: icon ? String(icon).trim() : 'target',
      color: color ? String(color).trim() : '#F59E0B',
      targetWalletId: targetWalletId || null,
      status: 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Tạo mục tiêu tài chính thành công!',
      data: goal,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * GET /api/goals/:id
 * Chi tiết mục tiêu và lịch sử đóng góp
 */
exports.getById = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID mục tiêu không hợp lệ.');

    const goal = await Goal.findOne({ _id: id, userId })
      .populate('targetWalletId', 'name type currency')
      .lean();

    if (!goal) return fail(res, 404, 'Không tìm thấy mục tiêu tài chính.');

    const contributions = await GoalContribution.find({ goalId: id, userId })
      .sort({ date: -1 })
      .limit(50)
      .populate('walletId', 'name type currency')
      .lean();

    const progressPercent =
      goal.targetAmount > 0
        ? round2(Math.min(100, (goal.currentAmount / goal.targetAmount) * 100))
        : 0;
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

    let daysLeft = null;
    if (goal.deadline) {
      const diffMs = new Date(goal.deadline).getTime() - Date.now();
      daysLeft = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    }

    return res.json({
      success: true,
      data: {
        ...goal,
        progressPercent,
        remaining,
        daysLeft,
        contributions,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * PATCH /api/goals/:id
 * Sửa thông tin mục tiêu
 */
exports.update = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID mục tiêu không hợp lệ.');

    const goal = await Goal.findOne({ _id: id, userId });
    if (!goal) return fail(res, 404, 'Không tìm thấy mục tiêu tài chính.');

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        return fail(res, 400, 'Tên mục tiêu không được để trống.');
      }
      updates.name = body.name.trim();
    }

    if (body.targetAmount !== undefined) {
      const n = Number(body.targetAmount);
      if (!Number.isFinite(n) || n <= 0) {
        return fail(res, 400, 'Số tiền mục tiêu phải là số lớn hơn 0.');
      }
      if (n < goal.currentAmount) {
        return fail(
          res,
          400,
          `Số tiền mục tiêu không thể nhỏ hơn số tiền đã tiết kiệm được (${goal.currentAmount.toLocaleString('vi-VN')} đ).`
        );
      }
      updates.targetAmount = n;
    }

    if (body.deadline !== undefined) {
      updates.deadline = body.deadline ? new Date(body.deadline) : null;
    }

    if (body.icon !== undefined) updates.icon = String(body.icon).trim();
    if (body.color !== undefined) updates.color = String(body.color).trim();

    if (body.targetWalletId !== undefined) {
      if (body.targetWalletId === null) {
        updates.targetWalletId = null;
      } else {
        if (!isValidId(body.targetWalletId)) return fail(res, 400, 'ID ví thụ hưởng không hợp lệ.');
        const w = await Wallet.findOne({ _id: body.targetWalletId, userId });
        if (!w) return fail(res, 404, 'Ví thụ hưởng không tồn tại.');
        updates.targetWalletId = body.targetWalletId;
      }
    }

    if (Object.keys(updates).length === 0) {
      return fail(res, 400, 'Không có thông tin nào để cập nhật.');
    }

    const updated = await Goal.findByIdAndUpdate(id, { $set: updates }, { new: true });
    return res.json({ success: true, message: 'Cập nhật mục tiêu thành công!', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

/**
 * POST /api/goals/:id/contributions
 * Đóng góp tiền tiết kiệm vào mục tiêu (trừ tiền ví thật, hạch toán chi Tiết kiệm).
 * Khi đạt target: tự động hoàn trả 100% về ví.
 */
exports.contribute = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { amount, walletId, note, idempotencyKey } = req.body;

    if (!isValidId(id)) return fail(res, 400, 'ID mục tiêu không hợp lệ.');
    if (!walletId || !isValidId(walletId)) return fail(res, 400, 'ID ví không hợp lệ.');

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return fail(res, 400, 'Số tiền tiết kiệm phải lớn hơn 0.');
    }

    const result = await runInTransaction(async (session) => {
      // 1. Kiểm tra mục tiêu
      const goal = await Goal.findOne({ _id: id, userId }).session(session);
      if (!goal) {
        const err = new Error('Không tìm thấy mục tiêu tài chính.');
        err.status = 404;
        throw err;
      }
      if (goal.status !== 'active') {
        const err = new Error('Mục tiêu này đã hoàn thành hoặc đã bị hủy.');
        err.status = 400;
        throw err;
      }

      // 2. Kiểm tra ví trích tiền
      const wallet = await Wallet.findOne({
        _id: walletId,
        userId,
        isArchived: { $ne: true },
      }).session(session);

      if (!wallet) {
        const err = new Error('Ví trích tiền không tồn tại.');
        err.status = 404;
        throw err;
      }

      if (wallet.type !== 'credit_card' && wallet.balance < numericAmount) {
        const err = new Error('Số dư ví không đủ để tiết kiệm.');
        err.status = 400;
        err.body = insufficientBody(wallet.balance, numericAmount);
        throw err;
      }

      // 3. Trừ tiền ví thực tế
      const deducted = await Wallet.findOneAndUpdate(
        {
          _id: wallet._id,
          $or: [{ type: 'credit_card' }, { balance: { $gte: numericAmount } }],
        },
        { $inc: { balance: -numericAmount } },
        { session, new: true }
      );

      if (!deducted) {
        const err = new Error('Số dư ví không đủ.');
        err.status = 400;
        err.body = insufficientBody(wallet.balance, numericAmount);
        throw err;
      }

      // 4. Tìm danh mục chi "Tiết kiệm"
      let savingCat = await Category.findOne({
        type: 'expense',
        name: 'Tiết kiệm',
      }).session(session);

      if (!savingCat) {
        savingCat = await Category.findOne({ type: 'expense', isDefault: true }).session(session);
      }

      // 5. Ghi nhận giao dịch chi "Tiết kiệm"
      const [tx] = await Transaction.create(
        [
          {
            userId,
            walletId: wallet._id,
            categoryId: savingCat ? savingCat._id : undefined,
            amount: numericAmount,
            type: 'expense',
            source: 'goal',
            goalId: goal._id,
            note: note ? note.trim() : `Tiết kiệm cho mục tiêu: ${goal.name}`,
            transactionDate: new Date(),
            idempotencyKey: idempotencyKey ? String(idempotencyKey).trim() : undefined,
          },
        ],
        { session }
      );

      // 6. Ghi lịch sử GoalContribution
      await GoalContribution.create(
        [
          {
            goalId: goal._id,
            userId,
            walletId: wallet._id,
            transactionId: tx._id,
            amount: numericAmount,
            note: note ? note.trim() : '',
            date: new Date(),
          },
        ],
        { session }
      );

      // 7. Cập nhật số tiền tích lũy của mục tiêu
      const newAmount = goal.currentAmount + numericAmount;
      goal.currentAmount = newAmount;

      let isCompleted = false;
      // 8. Nếu đạt mốc mục tiêu -> tự động hoàn tiền 100% về ví
      if (newAmount >= goal.targetAmount) {
        isCompleted = true;
        goal.status = 'completed';
        goal.completedAt = new Date();
        goal.refundAmount = newAmount;

        const refundWalletId = goal.targetWalletId || wallet._id;

        // Hoàn trả 100% số tiền tích lũy về ví
        await Wallet.findByIdAndUpdate(
          refundWalletId,
          { $inc: { balance: newAmount } },
          { session, new: true }
        );

        // Danh mục thu "Khác (Thu)"
        let incomeCat = await Category.findOne({
          type: 'income',
          name: 'Khác (Thu)',
        }).session(session);

        if (!incomeCat) {
          incomeCat = await Category.findOne({ type: 'income', isDefault: true }).session(session);
        }

        // Tạo giao dịch thu hoàn tiền
        await Transaction.create(
          [
            {
              userId,
              walletId: refundWalletId,
              categoryId: incomeCat ? incomeCat._id : undefined,
              amount: newAmount,
              type: 'income',
              source: 'goal',
              goalId: goal._id,
              note: `Hoàn trả tiền cho mục tiêu "${goal.name}" đã hoàn thành`,
              transactionDate: new Date(),
            },
          ],
          { session }
        );
      }

      await goal.save({ session });

      return {
        goal,
        transaction: tx,
        completed: isCompleted,
      };
    });

    const msg = result.completed
      ? 'Chúc mừng! Bạn đã hoàn thành mục tiêu. Tiền đã được hoàn trả 100% về ví của bạn.'
      : 'Đã đóng góp tiết kiệm thành công!';

    return res.status(201).json({
      success: true,
      message: msg,
      data: result,
    });
  } catch (error) {
    if (error.body) return res.status(error.status || 400).json(error.body);
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/goals/:id/cancel
 * Hủy mục tiêu tài chính: Phạt phí 5%, hoàn 95% tiền đã tiết kiệm về số dư ví.
 */
exports.cancel = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID mục tiêu không hợp lệ.');

    const result = await runInTransaction(async (session) => {
      const goal = await Goal.findOne({ _id: id, userId }).session(session);
      if (!goal) {
        const err = new Error('Không tìm thấy mục tiêu tài chính.');
        err.status = 404;
        throw err;
      }
      if (goal.status !== 'active') {
        const err = new Error('Chỉ có thể hủy mục tiêu đang ở trạng thái hoạt động.');
        err.status = 400;
        throw err;
      }

      const totalSaved = goal.currentAmount || 0;

      // Nếu chưa tiết kiệm được đồng nào
      if (totalSaved === 0) {
        goal.status = 'cancelled';
        goal.cancelledAt = new Date();
        goal.penaltyFee = 0;
        goal.refundAmount = 0;
        await goal.save({ session });
        return {
          goal,
          penaltyFee: 0,
          refundAmount: 0,
        };
      }

      // Có tiền tiết kiệm: phạt 5%, hoàn 95%
      const penaltyFee = Math.round(totalSaved * 0.05);
      const refundAmount = totalSaved - penaltyFee;

      // Xác định ví hoàn tiền
      let targetWallet = null;
      if (goal.targetWalletId) {
        targetWallet = await Wallet.findOne({
          _id: goal.targetWalletId,
          userId,
          isArchived: { $ne: true },
        }).session(session);
      }
      if (!targetWallet) {
        targetWallet = await Wallet.findOne({
          userId,
          isArchived: { $ne: true },
        })
          .sort({ createdAt: 1 })
          .session(session);
      }

      if (!targetWallet) {
        const err = new Error('Không tìm thấy ví khả dụng để hoàn tiền.');
        err.status = 400;
        throw err;
      }

      // Cộng 95% vào ví
      await Wallet.findByIdAndUpdate(
        targetWallet._id,
        { $inc: { balance: refundAmount } },
        { session }
      );

      // Danh mục thu
      let incomeCat = await Category.findOne({
        type: 'income',
        name: 'Khác (Thu)',
      }).session(session);

      if (!incomeCat) {
        incomeCat = await Category.findOne({ type: 'income', isDefault: true }).session(session);
      }

      // Tạo giao dịch thu hoàn tiền 95%
      await Transaction.create(
        [
          {
            userId,
            walletId: targetWallet._id,
            categoryId: incomeCat ? incomeCat._id : undefined,
            amount: refundAmount,
            type: 'income',
            source: 'goal',
            goalId: goal._id,
            note: `Hoàn trả tiền cho mục tiêu "${goal.name}" đã bị hủy`,
            transactionDate: new Date(),
          },
        ],
        { session }
      );

      goal.status = 'cancelled';
      goal.cancelledAt = new Date();
      goal.penaltyFee = penaltyFee;
      goal.refundAmount = refundAmount;
      await goal.save({ session });

      return {
        goal,
        penaltyFee,
        refundAmount,
        refundWallet: targetWallet,
      };
    });

    return res.json({
      success: true,
      message: `Đã hủy mục tiêu. Phí hủy 5% (${result.penaltyFee.toLocaleString('vi-VN')} đ), số tiền hoàn trả 95% (${result.refundAmount.toLocaleString('vi-VN')} đ) đã được chuyển về ví.`,
      data: result,
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/goals/:id/contributions
 * Lịch sử đóng góp vào mục tiêu
 */
exports.listContributions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    if (!isValidId(id)) return fail(res, 400, 'ID mục tiêu không hợp lệ.');

    const contributions = await GoalContribution.find({ goalId: id, userId })
      .sort({ date: -1 })
      .populate('walletId', 'name type currency')
      .lean();

    return res.json({ success: true, data: contributions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};
