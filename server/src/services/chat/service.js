const gemini = require('./gemini');
const { executeTool, declarations } = require('./tools');
const state = require('./state');
const { ChatError, bad, fields } = require('./errors');

async function sendMessage(userId, body) {
  fields(body, ['message', 'conversationId']);
  if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000) throw bad('Tin nhắn cần có từ 1 đến 2.000 ký tự.');
  gemini.assertConfigured();
  const lease = await state.acquireConversation(userId, body.conversationId);
  lease.deadlineAt = Date.now() + 30000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const timeoutError = () => new ChatError(504, 'AI_TIMEOUT', 'AI phản hồi quá chậm. Vui lòng thử lại.');
  const withinDeadline = async promise => {
    if (controller.signal.aborted) { promise.catch(() => {}); throw timeoutError(); }
    let abort;
    const expired = new Promise((_, reject) => {
      abort = () => reject(timeoutError());
      controller.signal.addEventListener('abort', abort, { once: true });
    });
    try { return await Promise.race([promise, expired]); }
    finally { controller.signal.removeEventListener('abort', abort); }
  };
  try {
    const current = await withinDeadline(state.currentAction(userId, lease.conversation));
    const context = JSON.stringify(state.publicAction(current));
    const contents = lease.conversation.messages.slice(-20).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    contents.push({ role: 'user', parts: [{ text: body.message.trim() }] });
    const facts = []; let draft; let calls = 0;
    for (let round = 0; round <= 4; round++) {
      const content = await withinDeadline(gemini.generate(contents, controller.signal, context));
      const toolCalls = content.parts.filter(p => p.functionCall).map(p => p.functionCall);
      if (!toolCalls.length) {
        let reply = content.parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('\n').trim();
        if (!reply || reply.length > 12000) throw new ChatError(502, 'AI_INVALID_RESPONSE', 'AI chưa trả lời hợp lệ.');
        if (draft) reply += '\n\nĐây là bản nháp, chưa ghi dữ liệu. Kiểm tra thông tin và bấm Xác nhận trong 10 phút để lưu.';
        if (controller.signal.aborted || Date.now() >= lease.deadlineAt) throw timeoutError();
        return await withinDeadline(state.saveTurn(userId, lease, body.message.trim(), reply, facts, draft));
      }
      calls += toolCalls.length;
      if (round === 4 || calls > 8) throw new ChatError(502, 'AI_TOOL_LIMIT', 'Yêu cầu quá phức tạp. Hãy chia thành câu hỏi nhỏ hơn.');
      // Gemini requires the original content, including signatures, between tool rounds.
      contents.push(content);
      const parts = [];
      for (const call of toolCalls) {
        if (!declarations.some(d => d.name === call.name)) throw new ChatError(502, 'AI_INVALID_TOOL', 'AI yêu cầu công cụ không được phép.');
        let result;
        try {
          if (draft && call.name.startsWith('draft_')) throw bad('Mỗi lượt chỉ đề xuất một thao tác.');
          result = await withinDeadline(executeTool(userId, call.name, call.args || {}));
          if (result.facts) facts.push(result.facts);
          if (result.draft) draft = result.draft;
        } catch (err) {
          if (!(err instanceof ChatError) || err.status !== 400) throw err;
          result = { error: err.message, instruction: 'Hỏi người dùng bổ sung hoặc chọn lại thông tin; không đoán.' };
        }
        parts.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: result } });
      }
      contents.push({ role: 'user', parts });
      if (Buffer.byteLength(JSON.stringify(contents)) > 131072) throw new ChatError(502, 'AI_CONTEXT_LIMIT', 'Dữ liệu quá lớn cho một lượt chat. Hãy hỏi cụ thể hơn.');
    }
  } finally {
    try { await withinDeadline(state.releaseConversation(userId, lease)); }
    catch { /* The expiring lease recovers if the database is temporarily unavailable. */ }
    finally { clearTimeout(timeout); }
  }
}
module.exports = { sendMessage };
