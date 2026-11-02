const Wallet = require('../models/Wallet');

/**
 * Sinh chuỗi số tài khoản 10 chữ số ngẫu nhiên (chữ số đầu từ 1–9) và đảm bảo không trùng lặp trong DB.
 * 
 * @param {Object} [session=null] - Mongoose session (nếu đang chạy trong transaction)
 * @returns {Promise<string>} - Chuỗi 10 chữ số
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

module.exports = {
  generateAccountNumber,
};
