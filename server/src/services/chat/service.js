const gemini = require('./gemini');
const tools = require('./tools');
const state = require('./state');
const { ChatError, bad, fields } = require('./errors');

async function sendMessage(userId, body) {
  fields(body, ['message', 'conversationId']);
  if (typeof body.message !== 'string' || !body.message.trim()) {
    throw bad('Nội dung tin nhắn không được để trống.');
  }
  const message = body.message.trim();
  if (message.length > 2000) {
    throw bad('Tin nhắn không được vượt quá 2000 ký tự.');
  }

  gemini.assertConfigured();

  const lease = await state.acquireConversation(userId, body.conversationId);
  const currentAction = typeof state.currentAction === 'function'
    ? await state.currentAction(userId, lease.conversation)
    : null;
  const context = currentAction
    ? `Bản nháp hiện tại: ${currentAction.kind}, trạng thái ${currentAction.status}, ID: ${currentAction._id || currentAction.id}.`
    : 'Không có bản nháp nào đang chờ.';

  const ac = new AbortController();
  let timerId;
  const deadlinePromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      ac.abort();
      reject(new ChatError(504, 'AI_TIMEOUT', 'AI phản hồi quá chậm. Vui lòng thử lại.'));
    }, 30000);
  });

  const runTurn = async () => {
    const rawMessages = lease.conversation.messages || [];
    const history = rawMessages.slice(-20);
    const contents = history.map(m => ({
      role: m.role,
      parts: [{ text: m.text }],
    }));
    contents.push({ role: 'user', parts: [{ text: message }] });

    const allowedToolNames = new Set((tools.declarations || []).map(d => d.name));
    let reply = '';
    const facts = [];
    let draft = null;
    let turnCount = 0;
    let callCount = 0;
    const maxTurns = 4;
    const maxCalls = 8;

    while (turnCount < maxTurns) {
      turnCount++;
      const modelContent = await gemini.generate([...contents], ac.signal, context);
      contents.push(modelContent);

      const functionCalls = modelContent.parts?.filter(p => p && p.functionCall) || [];
      const textPart = modelContent.parts?.find(p => typeof p.text === 'string' && p.text.trim());
      if (textPart) {
        reply = textPart.text;
      }

      if (functionCalls.length > 0) {
        callCount += functionCalls.length;
        if (callCount > maxCalls || turnCount >= maxTurns) {
          throw new ChatError(502, 'AI_TOOL_LIMIT', 'AI gọi công cụ quá giới hạn cho phép.');
        }

        const responseParts = [];
        for (const part of functionCalls) {
          const call = part.functionCall;
          if (!allowedToolNames.has(call.name)) {
            throw new ChatError(502, 'AI_INVALID_TOOL', `Công cụ ${call.name} không được phép.`);
          }

          let result;
          try {
            result = await tools.executeTool(userId, call.name, call.args || {});
            if (result.facts) facts.push(result.facts);
            if (result.draft) draft = result.draft;
          } catch (err) {
            if (err instanceof ChatError && err.status === 400) {
              result = { error: err.message };
            } else {
              throw err;
            }
          }

          responseParts.push({
            functionResponse: {
              name: call.name,
              response: result,
              ...(call.id ? { id: call.id } : {}),
            },
          });
        }

        contents.push({
          role: 'user',
          parts: responseParts,
        });
      } else {
        break;
      }
    }

    if (!reply) {
      reply = draft
        ? 'Tôi đã tạo bản nháp theo yêu cầu của bạn. Vui lòng bấm Xác nhận.'
        : 'Yêu cầu của bạn đã được xử lý.';
    }

    const saved = await state.saveTurn(
      userId,
      lease,
      message,
      reply,
      facts,
      draft || undefined
    );
    return saved;
  };

  try {
    return await Promise.race([runTurn(), deadlinePromise]);
  } finally {
    clearTimeout(timerId);
    try {
      if (typeof state.releaseConversation === 'function') {
        await state.releaseConversation(userId, lease);
      }
    } catch (_) {}
  }
}

module.exports = {
  sendMessage,
};
