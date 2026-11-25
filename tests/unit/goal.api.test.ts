jest.mock('../../src/api/config', () => ({ API_BASE_URL: 'http://localhost:5000/api' }));
import { goalApi } from '../../src/api/goal';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});

test('KAN-70 client goalApi calls pending-decision, extend, and expire-close endpoints', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [{ _id: 'g1', name: 'Laptop', overdueStage: 'decision_required' }] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { _id: 'g1' } }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { refundAmount: 500000, penaltyFee: 0 } }),
    });

  const pending = await goalApi.getPendingDecisions('tok');
  expect(pending).toHaveLength(1);
  expect(global.fetch).toHaveBeenNthCalledWith(
    1,
    'http://localhost:5000/api/goals/pending-decision',
    expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer tok' }),
    })
  );

  await goalApi.extendGoal('tok', 'g1', '2026-12-30T00:00:00.000Z');
  expect(global.fetch).toHaveBeenNthCalledWith(
    2,
    'http://localhost:5000/api/goals/g1/extend',
    expect.objectContaining({ method: 'POST' })
  );

  const closed = await goalApi.expireCloseGoal('tok', 'g1');
  expect(closed.data?.penaltyFee).toBe(0);
  expect(global.fetch).toHaveBeenNthCalledWith(
    3,
    'http://localhost:5000/api/goals/g1/expire-close',
    expect.objectContaining({ method: 'POST' })
  );
});
