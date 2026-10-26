/**
 * Tính khoảng thời gian (tuần/tháng/năm) theo giờ Hà Nội (Asia/Ho_Chi_Minh, UTC+7).
 * Tuần bắt đầu từ Thứ 2. Khoảng thời gian dạng [from, to).
 */
const PERIODS = ['week', 'month', 'year'];
const OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7
const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

// ms "giờ địa phương" (biểu diễn bằng UTC) -> chuỗi YYYY-MM-DD
const toDateStr = (localMs) => {
  const d = new Date(localMs);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

// Trả về ms 00:00 của ngày (giờ VN, biểu diễn bằng UTC), hoặc null nếu không hợp lệ
const parseLocalDay = (dateStr) => {
  if (dateStr === undefined || dateStr === null || dateStr === '') {
    const now = new Date(Date.now() + OFFSET_MS);
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) {
    return null; // vd 2026-02-31
  }
  return ms;
};

const toRange = (startLocal, endLocal) => ({
  from: new Date(startLocal - OFFSET_MS),
  to: new Date(endLocal - OFFSET_MS),
  fromStr: toDateStr(startLocal),
  toStr: toDateStr(endLocal - DAY_MS), // ngày cuối (bao gồm)
});

// Trả về [startLocal, endLocal) của kỳ chứa dayMs
const boundsOf = (period, dayMs) => {
  const d = new Date(dayMs);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  if (period === 'week') {
    const dow = (d.getUTCDay() + 6) % 7; // Thứ 2 = 0
    const start = dayMs - dow * DAY_MS;
    return [start, start + 7 * DAY_MS];
  }
  if (period === 'month') return [Date.UTC(y, m, 1), Date.UTC(y, m + 1, 1)];
  return [Date.UTC(y, 0, 1), Date.UTC(y + 1, 0, 1)];
};

// Một đơn vị kỳ trước, tính từ ngày bắt đầu kỳ hiện tại
const previousStart = (period, startLocal) => {
  if (period === 'week') return startLocal - 7 * DAY_MS;
  const d = new Date(startLocal);
  if (period === 'month') return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
  return Date.UTC(d.getUTCFullYear() - 1, 0, 1);
};

/**
 * @returns {{ period, from, to, fromStr, toStr, previous: {from,to,fromStr,toStr} } | null}
 * null nếu period hoặc date không hợp lệ.
 */
const getPeriodRange = (period = 'month', dateStr) => {
  if (!PERIODS.includes(period)) return null;
  const dayMs = parseLocalDay(dateStr);
  if (dayMs === null) return null;

  const [start, end] = boundsOf(period, dayMs);
  const prevStart = previousStart(period, start);
  const [, prevEnd] = boundsOf(period, prevStart);

  return {
    period,
    ...toRange(start, end),
    previous: toRange(prevStart, prevEnd),
  };
};

module.exports = { PERIODS, getPeriodRange };
