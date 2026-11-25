const Goal = require('../../models/Goal');

/**
 * Đọc tóm tắt mục tiêu tiết kiệm của chính user (chỉ đọc, phạm vi userId) phục vụ RAG/Function Calling (KAN-34).
 */
async function getGoalSummary(userId) {
  const rows = await Goal.find({ userId })
    .select('name targetAmount currentAmount status overdueStage deadline')
    .lean()
    .limit(20)
    .maxTimeMS(2000);

  return {
    facts: {
      goals: (rows || []).map((g) => ({
        name: g.name,
        targetAmount: g.targetAmount,
        currentAmount: g.currentAmount,
        progressPercent:
          g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0,
        status: g.status,
        overdueStage: g.overdueStage || 'none',
        deadline: g.deadline || null,
      })),
    },
  };
}

module.exports = { getGoalSummary };
