const { randomUUID } = require('crypto');
const realtime = require('../realtime.service');

/**
 * Tạo emitter AG-UI Mức 1 (gửi qua Socket.io sự kiện 'agui:event') cho một lượt chạy chatbot (KAN-34).
 */
function createAguiRun(userId, threadId) {
  const runId = randomUUID();
  const emit = (type, extra = {}) => {
    if (typeof realtime?.emitAguiEvent !== 'function') return;
    realtime.emitAguiEvent(String(userId), {
      type,
      runId,
      threadId: threadId ? String(threadId) : undefined,
      ...extra,
    });
  };
  return { runId, emit };
}

module.exports = { createAguiRun };
