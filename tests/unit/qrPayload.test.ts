import {
  generateQRPayload,
  parseQRPayload,
  QRPayloadUser,
} from '../../src/utils/qrPayload';

describe('QR Payload Utilities (generateQRPayload & parseQRPayload)', () => {
  const mockUser: QRPayloadUser = {
    id: 'user_123456',
    username: 'nguyenvana',
    nickname: 'Nguyễn Văn A',
    phone: '0901234567',
  };

  describe('generateQRPayload', () => {
    it('sinh mã QR tĩnh chuẩn khi amount = 0', () => {
      const qrString = generateQRPayload(mockUser, 0);
      expect(typeof qrString).toBe('string');

      const parsed = JSON.parse(qrString);
      expect(parsed.app).toBe('FinanceFlow');
      expect(parsed.version).toBe('1.0');
      expect(parsed.type).toBe('P2P_RECEIVE');
      expect(parsed.recipientId).toBe('user_123456');
      expect(parsed.username).toBe('nguyenvana');
      expect(parsed.nickname).toBe('Nguyễn Văn A');
      expect(parsed.phone).toBe('0901234567');
      expect(parsed.amount).toBeUndefined();
      expect(parsed.note).toBeUndefined();
    });

    it('sinh mã QR tĩnh chuẩn khi không truyền amount và note', () => {
      const qrString = generateQRPayload({
        _id: 'user_mongodb_id',
        username: 'tranb',
      });
      const parsed = JSON.parse(qrString);
      expect(parsed.recipientId).toBe('user_mongodb_id');
      expect(parsed.username).toBe('tranb');
      expect(parsed.amount).toBeUndefined();
      expect(parsed.note).toBeUndefined();
    });

    it('sinh mã QR động khi amount = 100.000 và note = "Cafe"', () => {
      const qrString = generateQRPayload(mockUser, 100000, 'Cafe');
      const parsed = JSON.parse(qrString);

      expect(parsed.app).toBe('FinanceFlow');
      expect(parsed.type).toBe('P2P_RECEIVE');
      expect(parsed.recipientId).toBe('user_123456');
      expect(parsed.amount).toBe(100000);
      expect(parsed.note).toBe('Cafe');
    });
  });

  describe('parseQRPayload', () => {
    it('giải mã thành công mã QR tĩnh hợp lệ', () => {
      const qrString = generateQRPayload(mockUser, 0);
      const result = parseQRPayload(qrString);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.app).toBe('FinanceFlow');
      expect(result.data?.type).toBe('P2P_RECEIVE');
      expect(result.data?.recipientId).toBe('user_123456');
      expect(result.data?.username).toBe('nguyenvana');
      expect(result.data?.nickname).toBe('Nguyễn Văn A');
      expect(result.data?.phone).toBe('0901234567');
      expect(result.data?.amount).toBeUndefined();
      expect(result.data?.note).toBeUndefined();
    });

    it('giải mã thành công mã QR động hợp lệ (amount = 100000, note = "Cafe")', () => {
      const qrString = generateQRPayload(mockUser, 100000, 'Cafe');
      const result = parseQRPayload(qrString);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.data).toBeDefined();
      expect(result.data?.recipientId).toBe('user_123456');
      expect(result.data?.amount).toBe(100000);
      expect(result.data?.note).toBe('Cafe');
    });

    it('từ chối mã QR ngoại lai từ ngân hàng khác (VietQR, Momo,...)', () => {
      const bankQr = JSON.stringify({
        app: 'VietQR',
        bankCode: '970422',
        accountNumber: '1903123456789',
        amount: 500000,
      });

      const result = parseQRPayload(bankQr);
      expect(result.valid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toMatch(/FinanceFlow/i);
    });

    it('từ chối mã QR FinanceFlow sai loại giao dịch (type !== P2P_RECEIVE)', () => {
      const wrongTypeQr = JSON.stringify({
        app: 'FinanceFlow',
        version: '1.0',
        type: 'MERCHANT_PAY',
        recipientId: 'merchant_999',
      });

      const result = parseQRPayload(wrongTypeQr);
      expect(result.valid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toMatch(/P2P/i);
    });

    it('từ chối mã QR FinanceFlow thiếu recipientId', () => {
      const missingRecipient = JSON.stringify({
        app: 'FinanceFlow',
        version: '1.0',
        type: 'P2P_RECEIVE',
        username: 'nguyenvana',
      });

      const result = parseQRPayload(missingRecipient);
      expect(result.valid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toMatch(/người nhận/i);
    });

    it('từ chối mã QR dạng URL website thông thường', () => {
      const urlPayload = 'https://financeflow.app/transfer?user=123456';
      const result = parseQRPayload(urlPayload);

      expect(result.valid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });

    it('từ chối chuỗi lỗi không phải định dạng JSON', () => {
      const invalidJson = 'HELLO_FINANCEFLOW_NOT_JSON';
      const result = parseQRPayload(invalidJson);

      expect(result.valid).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toMatch(/JSON/i);
    });

    it('từ chối chuỗi rỗng hoặc dữ liệu null/undefined', () => {
      expect(parseQRPayload('').valid).toBe(false);
      expect(parseQRPayload('   ').valid).toBe(false);
      expect(parseQRPayload(null as any).valid).toBe(false);
      expect(parseQRPayload(undefined as any).valid).toBe(false);
    });
  });
});
