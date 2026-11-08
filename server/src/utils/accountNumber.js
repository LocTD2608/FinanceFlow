const Wallet = require('../models/Wallet');

/**
 * Sinh chuỗi số tài khoản 10 chữ số ngẫu nhiên (chữ số đầu từ 1–9) và đảm bảo không trùng lặp trong DB.
 */
async function generateAccountNumber(session = null) {
  let isUnique = false;
  let accountNumber = '';
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    attempts++;
    const firstDigit = Math.floor(Math.random() * 9) + 1;
    const remainingDigits = Math.floor(Math.random() * 1000000000).toString().padStart(9, '0');
    accountNumber = `${firstDigit}${remainingDigits}`;

    let query = Wallet.findOne({ accountNumber });
    if (session && query && typeof query.session === 'function') {
      query = query.session(session);
    }
    const existing = query && typeof query.lean === 'function' ? await query.lean() : await query;
    if (!existing) {
      isUnique = true;
    }
  }

  if (!isUnique) {
    accountNumber = String(Date.now()).slice(-10);
  }

  return accountNumber;
}

/**
 * Tạo một "số đẹp" 10 chữ số dễ nhớ.
 * Các mẫu: lặp đôi, lặp 3, số tiến, kết hợp đối xứng.
 * VD: 2224666000, 1234567890, 9988776655, 8880009990
 */
function buildPrettyCandidate() {
  const strategy = Math.floor(Math.random() * 5);
  let digits = '';

  if (strategy === 0) {
    // Dạng ABB-CCC-DDD: 1 2 3 chữ số lặp lại (vd: 2224666000)
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 10);
    const c = Math.floor(Math.random() * 10);
    const d = Math.floor(Math.random() * 10);
    digits = `${a}${b}${b}${c}${c}${c}${d}${d}${d}${d}`;
  } else if (strategy === 1) {
    // Số tiến liên tục (vd: 1234567890)
    const start = Math.floor(Math.random() * 3); // 0,1,2
    digits = Array.from({ length: 10 }, (_, i) => (start + i) % 10).join('');
    if (digits[0] === '0') digits = '1' + digits.slice(1);
  } else if (strategy === 2) {
    // Đối xứng: 5 chữ số đầu rồi đảo ngược (vd: 1234554321)
    const half = Array.from({ length: 5 }, (_, i) =>
      i === 0 ? Math.floor(Math.random() * 9) + 1 : Math.floor(Math.random() * 10)
    );
    digits = half.join('') + [...half].reverse().join('');
  } else if (strategy === 3) {
    // Hai khối lặp 5+5 (vd: 1111122222)
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 10);
    digits = String(a).repeat(5) + String(b).repeat(5);
  } else {
    // Kết hợp số đẹp: AA00BB00CC (vd: 8800990011)
    const parts = Array.from({ length: 5 }, () => Math.floor(Math.random() * 10));
    digits = parts.map((p) => String(p).repeat(2)).join('');
    if (digits[0] === '0') digits = '1' + digits.slice(1);
  }

  return digits.slice(0, 10).padEnd(10, '0');
}

/**
 * Sinh một số tài khoản "đẹp" (dễ nhớ) chưa tồn tại trong DB.
 * Thử tối đa 15 lần trước khi fallback sang số ngẫu nhiên thường.
 */
async function generatePrettyAccountNumber() {
  let attempts = 0;
  while (attempts < 15) {
    attempts++;
    const candidate = buildPrettyCandidate();
    const existing = await Wallet.findOne({ accountNumber: candidate }).lean();
    if (!existing) return candidate;
  }
  // fallback
  return generateAccountNumber();
}

/**
 * Kiểm tra số tài khoản đã tồn tại hay chưa (trả về true nếu trùng).
 * Bỏ qua walletId của chính ví đang cập nhật (optional).
 */
async function isAccountNumberTaken(accountNumber, excludeWalletId = null) {
  const filter = { accountNumber };
  if (excludeWalletId) filter._id = { $ne: excludeWalletId };
  const existing = await Wallet.findOne(filter).lean();
  return !!existing;
}

module.exports = {
  generateAccountNumber,
  generatePrettyAccountNumber,
  isAccountNumberTaken,
};
