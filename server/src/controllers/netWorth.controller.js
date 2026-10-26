const netWorth = require('../services/netWorth.service');

/**
 * GET /api/networth/trend?months=6
 */
const trend = async (req, res) => {
  try {
    const data = await netWorth.getTrend(req.user.id, req.query.months);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/networth/snapshot — chụp ngay cho tháng hiện tại (cập nhật nếu đã có).
 */
const snapshot = async (req, res) => {
  try {
    const month = netWorth.currentMonth();
    await netWorth.snapshotAll(month, { overwrite: true, userId: req.user.id });
    const data = await netWorth.getTrend(req.user.id, 1);
    return res.status(201).json({ success: true, data: data[0] || null });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { trend, snapshot };
