/**
 * Tiện ích cập nhật số dư ví an toàn.
 *
 * Quy tắc: ví thường KHÔNG BAO GIỜ âm, ví `credit_card` được phép âm (âm = dư nợ).
 * Mọi khoản trừ lên ví thường dùng cập nhật có điều kiện `balance >= số tiền trừ`,
 * nên an toàn kể cả khi nhiều request chạy đồng thời.
 */
const Wallet = require('../models/Wallet');

/**
 * Chuyển giao dịch thành danh sách thay đổi số dư theo ví.
 * @param {{type: string, amount: number, walletId: any, destinationWalletId?: any}} tx
 * @param {boolean} revert true khi hoàn tác giao dịch (khi sửa/xóa)
 * @returns {Array<{walletId: any, delta: number}>}
 */
const deltasFor = ({ type, amount, walletId, destinationWalletId }, revert = false) => {
  const n = Number(amount);
  if (!n || n <= 0) return [];
  const sign = revert ? -1 : 1;
  if (type === 'expense') return [{ walletId, delta: -n * sign }];
  if (type === 'income') return [{ walletId, delta: n * sign }];
  if (type === 'transfer') {
    const list = [{ walletId, delta: -n * sign }];
    if (destinationWalletId) list.push({ walletId: destinationWalletId, delta: n * sign });
    return list;
  }
  return [];
};

/**
 * Áp một thay đổi số dư. Trả về ví sau cập nhật, hoặc null nếu bị từ chối
 * (khoản trừ làm ví thường âm).
 */
const applyDelta = async (walletId, delta) => {
  if (delta >= 0) {
    return Wallet.findByIdAndUpdate(walletId, { $inc: { balance: delta } }, { new: true });
  }
  return Wallet.findOneAndUpdate(
    { _id: walletId, $or: [{ type: 'credit_card' }, { balance: { $gte: -delta } }] },
    { $inc: { balance: delta } },
    { new: true }
  );
};

/**
 * Áp nhiều thay đổi số dư. Khoản cộng được áp trước khoản trừ (để sửa giao dịch
 * trên cùng một ví không bị từ chối oan). Một khoản thất bại thì hoàn tác các khoản đã áp.
 * @returns {Promise<{ok: true} | {ok: false, walletId: any, delta: number}>}
 */
const applyDeltas = async (deltas) => {
  const ordered = [...deltas].sort((a, b) => b.delta - a.delta);
  const applied = [];
  for (const d of ordered) {
    const result = await applyDelta(d.walletId, d.delta);
    if (!result) {
      for (const done of applied.reverse()) {
        // Hoàn tác thô, không áp điều kiện số dư
        await Wallet.findByIdAndUpdate(done.walletId, { $inc: { balance: -done.delta } }, { new: true });
      }
      return { ok: false, walletId: d.walletId, delta: d.delta };
    }
    applied.push(d);
  }
  return { ok: true };
};

/**
 * Tạo body lỗi INSUFFICIENT_BALANCE chuẩn cho client.
 */
const insufficientBody = (currentBalance, requiredAmount, message) => ({
  success: false,
  code: 'INSUFFICIENT_BALANCE',
  message: message || 'Số dư trong ví không đủ để thực hiện giao dịch.',
  currentBalance,
  requiredAmount,
  shortfall: Math.max(0, requiredAmount - currentBalance),
});

module.exports = { deltasFor, applyDelta, applyDeltas, insufficientBody };
