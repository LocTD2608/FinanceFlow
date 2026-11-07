const Action = require('../../models/ChatAction');
const Conversation = require('../../models/ChatConversation');
const Wallet = require('../../models/Wallet');
const Transaction = require('../../models/Transaction');
const Budget = require('../../models/Budget');
const { runInTransaction } = require('../../utils/dbTransaction');
const realtime = require('../realtime.service');
const { validateDraft } = require('./tools');
const { ChatError, bad, notFound, objectId } = require('./errors');

function usable(action) {
  if (!action) throw notFound();
  if (action.status === 'confirmed') return;
  if (action.status === 'cancelled') throw new ChatError(409, 'ACTION_CANCELLED', 'Bản nháp đã bị hủy hoặc thay thế.');
  if (action.status === 'expired' || action.expiresAt <= new Date()) throw new ChatError(410, 'ACTION_EXPIRED', 'Bản nháp đã hết hạn. Hãy tạo lại.');
}
async function confirm(userId, id) {
  if (!objectId(id)) throw bad('ID bản nháp không hợp lệ.');
  // Confirmed results are usable even if the conversation has expired or AI is unavailable.
  const existing = await Action.findOne({ _id: id, userId, purgeAt: { $gt: new Date() } }).lean();
  usable(existing);
  if (existing.status === 'confirmed') return existing.result;
  let outcome;
  try {
    outcome = await runInTransaction(async session => {
      const action = await Action.findOne({ _id: id, userId, purgeAt: { $gt: new Date() } }).session(session);
      usable(action);
      if (action.status === 'confirmed') return { result: action.result };
      // Write both documents to serialize confirmation against draft replacement and cancellation.
      const conversation = await Conversation.findOneAndUpdate({ _id: action.conversationId, userId, pendingActionId: action._id,
        expiresAt: { $gt: new Date() }, lockUntil: { $lte: new Date() } }, { $inc: { actionVersion: 1 } }, { session, new: true });
      if (!conversation) throw new ChatError(409, 'ACTION_CONFLICT', 'Hội thoại đang xử lý hoặc bản nháp đã bị thay thế.');
      const p = action.payload;
      const input = action.kind === 'create_transaction'
        ? { type: p.type, amount: p.amount, walletId: p.walletId, categoryId: p.categoryId,
          date: new Date(new Date(p.transactionDate).getTime() + 7 * 3600000).toISOString().slice(0, 10), note: p.note }
        : { categoryId: p.categoryId, limitAmount: p.limitAmount, month: p.month };
      const checked = await validateDraft(userId, action.kind, input, session);
      let record, event;
      if (action.kind === 'create_transaction') {
        const delta = p.type === 'income' ? p.amount : -p.amount;
        const wallet = await Wallet.findOneAndUpdate({ _id: p.walletId, userId, isArchived: false, currency: 'VND',
          ...(delta < 0 ? { $or: [{ type: 'credit_card' }, { balance: { $gte: -delta } }] } : {}) },
        { $inc: { balance: delta } }, { session, new: true });
        if (!wallet) throw new ChatError(400, 'INSUFFICIENT_BALANCE', 'Ví không khả dụng hoặc không đủ số dư.');
        [record] = await Transaction.create([{ userId, ...checked.payload, idempotencyKey: `chat:${id}` }], { session });
        event = { type: p.type, direction: delta > 0 ? 'in' : 'out', amount: p.amount,
          walletId: String(wallet._id), walletName: wallet.name, newBalance: wallet.balance, note: p.note };
      } else {
        [record] = await Budget.create([{ userId, ...checked.payload }], { session });
      }
      const result = { kind: action.kind, resultId: String(record._id), record: record.toObject() };
      action.status = 'confirmed'; action.result = result;
      await action.save({ session });
      return { result, event };
    });
  } catch (err) {
    if (err.code === 11000) throw new ChatError(409, 'ACTION_DUPLICATE', 'Giao dịch hoặc ngân sách này đã tồn tại.');
    throw err;
  }
  if (outcome.event) realtime.emitBalanceChange(userId, outcome.event);
  return outcome.result;
}
async function cancel(userId, id) {
  if (!objectId(id)) throw bad('ID bản nháp không hợp lệ.');
  const action = await Action.findOneAndUpdate({ _id: id, userId, status: 'pending', purgeAt: { $gt: new Date() } },
    { $set: { status: 'cancelled' } }, { new: true });
  if (action) return { id, status: 'cancelled' };
  const existing = await Action.findOne({ _id: id, userId, purgeAt: { $gt: new Date() } });
  if (!existing) throw notFound();
  if (existing.status === 'confirmed') throw new ChatError(409, 'ACTION_CONFIRMED', 'Thao tác đã được thực hiện.');
  return { id, status: existing.status };
}
module.exports = { confirm, cancel };
