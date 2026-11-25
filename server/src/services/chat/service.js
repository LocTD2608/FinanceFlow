const gemini = require('./gemini');
const { executeTool, declarations } = require('./tools');
const state = require('./state');
const { ChatError, bad, fields } = require('./errors');
const { createAguiRun } = require('./agui');
const { parseBillImage } = require('./ocr');

async function sendMessage(userId, body) {
  fields(body, ['message', 'conversationId', 'imageBase64', 'imageMimeType']);
  const billPart = parseBillImage(body);
  const rawMessage = body.message === undefined && billPart ? 'Quét hóa đơn từ ảnh này giúp tôi' : body.message;
  if (typeof rawMessage !== 'string' || (!billPart && !rawMessage.trim()) || rawMessage.length > 2000) {
    throw bad('Tin nhắn cần có từ 1 đến 2.000 ký tự.');
  }
  const userMessage = rawMessage.trim() || 'Quét hóa đơn từ ảnh này giúp tôi';
  gemini.assertConfigured();
  const lease = await state.acquireConversation(userId, body.conversationId);
  lease.deadlineAt = Date.now() + 30000;
  const agui = createAguiRun(userId, lease.conversation._id);
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
    agui.emit('RUN_STARTED');
    if (billPart) agui.emit('STEP_STARTED', { stepName: 'bill_ocr' });
    const current = await withinDeadline(state.currentAction(userId, lease.conversation));
    const context = JSON.stringify(state.publicAction(current));
    const contents = lease.conversation.messages.slice(-20).map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    const userParts = billPart ? [{ text: userMessage }, billPart] : [{ text: userMessage }];
    contents.push({ role: 'user', parts: userParts });
    const facts = []; let draft; let calls = 0;
    for (let round = 0; round <= 4; round++) {
      agui.emit('STEP_STARTED', { stepName: 'llm_reasoning' });
      const content = await withinDeadline(gemini.generate(contents, controller.signal, context));
      agui.emit('STEP_FINISHED', { stepName: 'llm_reasoning' });
      const toolCalls = content.parts.filter(p => p.functionCall).map(p => p.functionCall);
      if (!toolCalls.length) {
        if (billPart) agui.emit('STEP_FINISHED', { stepName: 'bill_ocr' });
        let reply = content.parts.filter(p => !p.thought && typeof p.text === 'string').map(p => p.text).join('\n').trim();
        if (!reply || reply.length > 12000) throw new ChatError(502, 'AI_INVALID_RESPONSE', 'AI chưa trả lời hợp lệ.');
        if (draft) reply += '\n\nĐây là bản nháp, chưa ghi dữ liệu. Kiểm tra thông tin và bấm Xác nhận trong 10 phút để lưu.';
        if (controller.signal.aborted || Date.now() >= lease.deadlineAt) throw timeoutError();
        const saved = await withinDeadline(state.saveTurn(userId, lease, userMessage, reply, facts, draft));
        agui.emit('TEXT_MESSAGE_CONTENT', { content: reply });
        if (draft && saved?.pendingAction) {
          agui.emit('STATE_DELTA', { delta: { pendingAction: saved.pendingAction } });
        }
        agui.emit('RUN_FINISHED');
        return saved;
      }
      calls += toolCalls.length;
      if (round === 4 || calls > 8) throw new ChatError(502, 'AI_TOOL_LIMIT', 'Yêu cầu quá phức tạp. Hãy chia thành câu hỏi nhỏ hơn.');
      // Gemini requires the original content, including signatures, between tool rounds.
      contents.push(content);
      const parts = [];
      for (const call of toolCalls) {
        if (!declarations.some(d => d.name === call.name)) throw new ChatError(502, 'AI_INVALID_TOOL', 'AI yêu cầu công cụ không được phép.');
        agui.emit('TOOL_CALL_START', { toolName: call.name });
        let result;
        try {
          if (draft && call.name.startsWith('draft_')) throw bad('Mỗi lượt chỉ đề xuất một thao tác.');
          result = await withinDeadline(executeTool(userId, call.name, call.args || {}));
          if (result.facts) facts.push(result.facts);
          if (result.draft) draft = result.draft;
          agui.emit('TOOL_CALL_RESULT', { toolName: call.name });
        } catch (err) {
          if (!(err instanceof ChatError) || err.status !== 400) throw err;
          result = { error: err.message, instruction: 'Hỏi người dùng bổ sung hoặc chọn lại thông tin; không đoán.' };
          agui.emit('TOOL_CALL_RESULT', { toolName: call.name });
        }
        parts.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: result } });
      }
      contents.push({ role: 'user', parts });
      if (Buffer.byteLength(JSON.stringify(contents)) > 131072) throw new ChatError(502, 'AI_CONTEXT_LIMIT', 'Dữ liệu quá lớn cho một lượt chat. Hãy hỏi cụ thể hơn.');
    }
  } catch (err) {
    agui.emit('RUN_ERROR', { message: err?.message || 'Lỗi xử lý AI.' });
    throw err;
  } finally {
    try { await withinDeadline(state.releaseConversation(userId, lease)); }
    catch { /* The expiring lease recovers if the database is temporarily unavailable. */ }
    finally { clearTimeout(timeout); }
  }
}
module.exports = { sendMessage };
