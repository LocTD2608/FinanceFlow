const { randomUUID } = require('crypto');
const Conversation = require('../../models/ChatConversation');
const Action = require('../../models/ChatAction');
const Quota = require('../../models/ChatQuota');
const { ChatError, notFound, bad, objectId } = require('./errors');
const RETENTION = 30 * 86400000;
const publicAction = a => a ? { id: String(a._id), kind: a.kind, preview: a.preview,
  status: a.status === 'pending' && a.expiresAt <= new Date() ? 'expired' : a.status, expiresAt: a.expiresAt } : null;

async function consumeQuota(userId, kind, limit) {
  const bucket = Math.floor(Date.now() / 60000);
  const _id = `${userId}:${kind}:${bucket}`;
  try {
    const res = await Quota.findOneAndUpdate({ _id, count: { $lt: limit } }, {
      $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60000) },
    }, { upsert: true, new: true });
    if (!res) throw new ChatError(429, 'CHAT_RATE_LIMIT', 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau một phút.');
  } catch (err) {
    if (err.code === 11000) {
      const res = await Quota.findOneAndUpdate({ _id, count: { $lt: limit } }, { $inc: { count: 1 } }, { new: true });
      if (!res) throw new ChatError(429, 'CHAT_RATE_LIMIT', 'Bạn gửi yêu cầu quá nhanh. Vui lòng thử lại sau một phút.');
      return;
    }
    throw err;
  }
}

async function acquireConversation(userId, id) {
  if (id !== undefined && !objectId(id)) throw bad('ID hội thoại không hợp lệ.');
  const token = randomUUID();
  const lockUntil = new Date(Date.now() + 45000);
  if (!id) {
    const conversation = await Conversation.create({ userId, lockToken: token, lockUntil, expiresAt: new Date(Date.now() + RETENTION) });
    return { conversation, token };
  }
  const conversation = await Conversation.findOneAndUpdate({ _id: id, userId, expiresAt: { $gt: new Date() }, lockUntil: { $lte: new Date() } },
    { $set: { lockToken: token, lockUntil } }, { new: true });
  if (!conversation) {
    if (!await Conversation.exists({ _id: id, userId, expiresAt: { $gt: new Date() } })) throw notFound();
    throw new ChatError(409, 'CHAT_BUSY', 'Hội thoại đang xử lý một yêu cầu khác.');
  }
  return { conversation, token };
}
async function releaseConversation(userId, lease) {
  await Conversation.updateOne({ _id: lease.conversation._id, userId, lockToken: lease.token },
    { $set: { lockUntil: new Date(0) }, $unset: { lockToken: 1 } });
}
async function currentAction(userId, conversation) {
  if (!conversation.pendingActionId) return null;
  return Action.findOne({ _id: conversation.pendingActionId, userId, purgeAt: { $gt: new Date() } }).lean();
}
async function getConversation(userId, id) {
  if (!objectId(id)) throw bad('ID hội thoại không hợp lệ.');
  const c = await Conversation.findOne({ _id: id, userId, expiresAt: { $gt: new Date() } }).lean();
  if (!c) throw notFound();
  return { conversationId: String(c._id), messages: c.messages, pendingAction: publicAction(await currentAction(userId, c)) };
}
async function saveTurn(userId, lease, message, reply, facts, draft) {
  let action;
  if (draft) action = await Action.create({ userId, conversationId: lease.conversation._id, ...draft,
    expiresAt: new Date(Date.now() + 10 * 60000), purgeAt: new Date(Date.now() + RETENTION) });
  const messages = [...lease.conversation.messages.map(m => ({ role: m.role, text: m.text })),
    { role: 'user', text: message }, { role: 'model', text: reply }].slice(-40);
  while (Buffer.byteLength(JSON.stringify(messages)) > 65536 && messages.length > 2) messages.splice(0, 2);
  try {
    const saved = await Conversation.findOneAndUpdate({ _id: lease.conversation._id, userId, lockToken: lease.token,
      lockUntil: { $gt: new Date() }, expiresAt: { $gt: new Date() } },
    { $set: { messages, ...(action ? { pendingActionId: action._id } : {}) } }, { new: true });
    if (!saved) throw new ChatError(409, 'CHAT_LEASE_EXPIRED', 'Hội thoại hết thời gian xử lý. Vui lòng gửi lại.');
    if (action && lease.conversation.pendingActionId) {
      await Action.updateOne({ _id: lease.conversation.pendingActionId, userId, status: 'pending' }, { $set: { status: 'cancelled' } });
    }
    return { conversationId: String(saved._id), reply, facts, pendingAction: publicAction(action || await currentAction(userId, saved)) };
  } catch (err) {
    // A saved pointer remains authoritative even if cancellation cleanup fails.
    if (action && !await Conversation.exists({ _id: lease.conversation._id, userId, pendingActionId: action._id })) {
      await Action.deleteOne({ _id: action._id, userId });
    }
    throw err;
  }
}
module.exports = { consumeQuota, acquireConversation, releaseConversation, saveTurn, getConversation, currentAction, publicAction };
