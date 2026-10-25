/**
 * Gửi email (OTP) qua SMTP bằng nodemailer. Mặc định dùng Gmail + App Password.
 * Biến môi trường: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
 */
const nodemailer = require('nodemailer');

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT) || 465;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465, // 465 = SSL, 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transporter;
};

const isConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

/**
 * Che email: "abc@gmail.com" -> "a***@gmail.com"
 */
const maskEmail = (email) => {
  const [name = '', domain = ''] = String(email).split('@');
  if (!domain) return '***';
  return `${name.charAt(0)}***@${domain}`;
};

/**
 * Gửi mã OTP thanh toán. Ném lỗi nếu chưa cấu hình hoặc gửi thất bại.
 */
const sendOtpEmail = async (to, otp, { amount, ttlMinutes = 3 } = {}) => {
  if (!isConfigured()) {
    throw new Error('Chưa cấu hình SMTP_USER / SMTP_PASS để gửi email OTP.');
  }
  const amountText = typeof amount === 'number' ? ` cho giao dịch ${amount.toLocaleString('vi-VN')} đ` : '';
  await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'FinanceFlow - Mã OTP xác nhận thanh toán',
    text:
      `Mã OTP của bạn${amountText} là: ${otp}\n` +
      `Mã có hiệu lực trong ${ttlMinutes} phút. Tuyệt đối không chia sẻ mã này với bất kỳ ai.`,
    html:
      `<div style="font-family:Arial,sans-serif;max-width:420px">` +
      `<h2 style="color:#16a34a">FinanceFlow</h2>` +
      `<p>Mã OTP xác nhận thanh toán${amountText}:</p>` +
      `<p style="font-size:32px;font-weight:bold;letter-spacing:8px;margin:16px 0">${otp}</p>` +
      `<p>Mã có hiệu lực trong <b>${ttlMinutes} phút</b>. Không chia sẻ mã này với bất kỳ ai.</p>` +
      `</div>`,
  });
};

module.exports = { sendOtpEmail, maskEmail, isConfigured };
