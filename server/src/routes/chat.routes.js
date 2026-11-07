const express = require('express');
const { randomUUID } = require('crypto');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { sendMessage } = require('../services/chat/service');
const actions = require('../services/chat/actions');
const state = require('../services/chat/state');
const { ChatError, fields, objectId } = require('../services/chat/errors');
const router = express.Router();
router.use(auth);
router.use(async (req, res, next) => {
  try {
    if (!objectId(req.user.id)) throw new ChatError(401, 'UNAUTHORIZED', 'Phiên đăng nhập không hợp lệ.');
    const user = await User.findById(req.user.id).select('status');
    if (!user) throw new ChatError(401, 'UNAUTHORIZED', 'Tài khoản không còn tồn tại.');
    if (user.status === 'locked') throw new ChatError(403, 'ACCOUNT_LOCKED', 'Tài khoản đã bị khóa.');
    next();
  } catch (err) {
    next(err instanceof ChatError ? err : new ChatError(503, 'AUTH_UNAVAILABLE', 'Không thể kiểm tra tài khoản lúc này.'));
  }
});
const route = handler => async (req, res, next) => {
  try { res.json({ success: true, data: await handler(req) }); } catch (err) { next(err); }
};
router.post('/messages', route(async req => {
  await state.consumeQuota(req.user.id, 'message', 10);
  return sendMessage(req.user.id, req.body);
}));
router.get('/conversations/:id', route(req => state.getConversation(req.user.id, req.params.id)));
for (const operation of ['confirm', 'cancel']) {
  router.post(`/actions/:id/${operation}`, route(async req => {
    fields(req.body || {}, []);
    await state.consumeQuota(req.user.id, 'action', 30);
    return actions[operation](req.user.id, req.params.id);
  }));
}
router.use((err, req, res, next) => {
  const requestId = randomUUID();
  const known = err instanceof ChatError || err.code === 'TRANSACTION_UNSUPPORTED';
  if (!known) console.error('chat_request_failed', { requestId, code: 'CHAT_UNAVAILABLE' });
  const status = known ? err.status : 503;
  if (status === 429) res.set('Retry-After', '60');
  res.status(status).json({ success: false, code: known ? err.code : 'CHAT_UNAVAILABLE',
    message: known ? err.message : 'Chatbot tạm thời không khả dụng. Vui lòng thử lại.', requestId });
});
module.exports = router;
