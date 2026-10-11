const { getPeriodRange } = require('../src/utils/period');

describe('getPeriodRange', () => {
  it('period/date không hợp lệ -> null', () => {
    expect(getPeriodRange('day', '2026-10-11')).toBeNull();
    expect(getPeriodRange('month', 'abc')).toBeNull();
    expect(getPeriodRange('month', '2026-02-31')).toBeNull();
  });

  it('tuần bắt đầu Thứ 2 (11/10/2026 là Chủ nhật)', () => {
    const r = getPeriodRange('week', '2026-10-11');
    expect(r.fromStr).toBe('2026-10-05');
    expect(r.toStr).toBe('2026-10-11');
    expect(r.previous.fromStr).toBe('2026-09-28');
    expect(r.previous.toStr).toBe('2026-10-04');
  });

  it('tuần: ngày Thứ 2 là ngày đầu tuần', () => {
    const r = getPeriodRange('week', '2026-10-05');
    expect(r.fromStr).toBe('2026-10-05');
  });

  it('tháng 31 ngày và kỳ trước 30 ngày', () => {
    const r = getPeriodRange('month', '2026-10-15');
    expect(r.fromStr).toBe('2026-10-01');
    expect(r.toStr).toBe('2026-10-31');
    expect(r.previous.fromStr).toBe('2026-09-01');
    expect(r.previous.toStr).toBe('2026-09-30');
  });

  it('tháng 2 năm nhuận có 29 ngày', () => {
    expect(getPeriodRange('month', '2028-02-10').toStr).toBe('2028-02-29');
    expect(getPeriodRange('month', '2026-02-10').toStr).toBe('2026-02-28');
  });

  it('tháng 1 -> kỳ trước là tháng 12 năm trước', () => {
    const r = getPeriodRange('month', '2026-01-20');
    expect(r.previous.fromStr).toBe('2025-12-01');
    expect(r.previous.toStr).toBe('2025-12-31');
  });

  it('năm và kỳ trước', () => {
    const r = getPeriodRange('year', '2026-06-01');
    expect(r.fromStr).toBe('2026-01-01');
    expect(r.toStr).toBe('2026-12-31');
    expect(r.previous.fromStr).toBe('2025-01-01');
  });

  it('múi giờ UTC+7: 00:00 ngày 01/10 giờ VN = 17:00 UTC ngày 30/09', () => {
    const r = getPeriodRange('month', '2026-10-15');
    expect(r.from.toISOString()).toBe('2026-09-30T17:00:00.000Z');
    expect(r.to.toISOString()).toBe('2026-10-31T17:00:00.000Z');
  });

  it('không truyền date -> dùng hôm nay, mặc định month', () => {
    const r = getPeriodRange(undefined, undefined);
    expect(r.period).toBe('month');
    expect(r.from).toBeInstanceOf(Date);
  });
});
