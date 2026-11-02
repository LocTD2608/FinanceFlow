import { generateQRPayload, parseQRPayload } from '../../src/utils/qrPayload';
import { p2pApi } from '../../src/api/p2p';
import { securityApi } from '../../src/api/security';

describe('Smoke Test & Module Integrity', () => {
  it('should pass basic environment check', () => {
    expect(1 + 1).toBe(2);
  });

  describe('QR Payload Encoder & Parser', () => {
    it('should generate valid static QR payload for P2P receiving', () => {
      const user = {
        id: 'usr_smoke_123',
        username: 'smoketester',
        nickname: 'Smoke Tester',
        phone: '0987654321',
      };

      const rawJson = generateQRPayload(user);
      expect(typeof rawJson).toBe('string');

      const parsed = JSON.parse(rawJson);
      expect(parsed.app).toBe('FinanceFlow');
      expect(parsed.version).toBe('1.0');
      expect(parsed.type).toBe('P2P_RECEIVE');
      expect(parsed.recipientId).toBe('usr_smoke_123');
      expect(parsed.username).toBe('smoketester');
      expect(parsed.nickname).toBe('Smoke Tester');
      expect(parsed.amount).toBeUndefined();
    });

    it('should generate and parse dynamic QR payload with amount and note', () => {
      const user = {
        id: 'usr_smoke_456',
        username: 'bob',
        nickname: 'Bob Trần',
      };
      const amount = 250000;
      const note = 'Trả tiền liên hoan';

      const rawJson = generateQRPayload(user, amount, note);
      const result = parseQRPayload(rawJson);

      expect(result.valid).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.recipientId).toBe('usr_smoke_456');
      expect(result.data?.username).toBe('bob');
      expect(result.data?.amount).toBe(250000);
      expect(result.data?.note).toBe('Trả tiền liên hoan');
    });

    it('should reject invalid or alien QR payloads', () => {
      // Empty input
      const emptyRes = parseQRPayload('');
      expect(emptyRes.valid).toBe(false);
      expect(emptyRes.error).toBeDefined();

      // Malformed JSON
      const malformedRes = parseQRPayload('not-a-json-string');
      expect(malformedRes.valid).toBe(false);

      // Alien app
      const alienAppRes = parseQRPayload(
        JSON.stringify({
          app: 'AnotherWallet',
          type: 'P2P_RECEIVE',
          recipientId: '123',
        })
      );
      expect(alienAppRes.valid).toBe(false);
      expect(alienAppRes.error).toMatch(/FinanceFlow/i);
    });
  });

  describe('API Availability', () => {
    it('should provide complete P2P Transfer API contract', () => {
      expect(p2pApi).toBeDefined();
      expect(typeof p2pApi.lookupRecipient).toBe('function');
      expect(typeof p2pApi.transfer).toBe('function');
      expect(typeof p2pApi.listTransfers).toBe('function');
      expect(typeof p2pApi.getTransferById).toBe('function');
    });

    it('should provide complete Security & PIN API contract', () => {
      expect(securityApi).toBeDefined();
      expect(typeof securityApi.getPinStatus).toBe('function');
      expect(typeof securityApi.setupPin).toBe('function');
      expect(typeof securityApi.verifyPin).toBe('function');
      expect(typeof securityApi.changePin).toBe('function');
      expect(typeof securityApi.forgotPin).toBe('function');
      expect(typeof securityApi.resetPinWithOtp).toBe('function');
      expect(typeof securityApi.toggleBiometric).toBe('function');
    });
  });
});
