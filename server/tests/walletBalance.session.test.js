const { applyDelta, applyDeltas } = require('../src/utils/walletBalance');
const Wallet = require('../src/models/Wallet');

jest.mock('../src/models/Wallet');

describe('walletBalance with session', () => {
  afterEach(() => jest.clearAllMocks());

  it('truyền session vào findByIdAndUpdate khi delta >= 0', async () => {
    const mockSession = { id: 'mock-session-id' };
    Wallet.findByIdAndUpdate.mockResolvedValue({ _id: 'w1', balance: 1000 });

    await applyDelta('w1', 500, { session: mockSession });
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      'w1',
      { $inc: { balance: 500 } },
      { new: true, session: mockSession }
    );
  });

  it('truyền session vào findOneAndUpdate khi trừ tiền ví thường', async () => {
    const mockSession = { id: 'mock-session-id' };
    Wallet.findOneAndUpdate.mockResolvedValue({ _id: 'w1', balance: 500 });

    await applyDelta('w1', -500, { session: mockSession });
    expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'w1', $or: [{ type: 'credit_card' }, { balance: { $gte: 500 } }] },
      { $inc: { balance: -500 } },
      { new: true, session: mockSession }
    );
  });

  it('applyDeltas truyền session khi cập nhật nhiều ví', async () => {
    const mockSession = { id: 'mock-session-id' };
    Wallet.findByIdAndUpdate.mockResolvedValue({ _id: 'w1', balance: 1000 });

    const res = await applyDeltas([{ walletId: 'w1', delta: 500 }], { session: mockSession });
    expect(res).toEqual({ ok: true });
    expect(Wallet.findByIdAndUpdate).toHaveBeenCalledWith(
      'w1',
      { $inc: { balance: 500 } },
      { new: true, session: mockSession }
    );
  });
});
