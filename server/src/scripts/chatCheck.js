const path = require('path');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { generate, assertConfigured } = require('../services/chat/gemini');
const { executeTool } = require('../services/chat/tools');

// Opt-in live diagnostic: never writes application data or prints credentials.
async function checkMongo() {
  const uri = process.env.MONGODB_URI;
  if (!uri || /<[^>]+>/.test(uri)) throw Object.assign(new Error(), { code: 'MONGO_NOT_CONFIGURED' });
  const connection = mongoose.createConnection(uri, {
    autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000,
  });
  try {
    await connection.asPromise();
    const ping = await connection.db.admin().command({ ping: 1 });
    assert.equal(ping.ok, 1);
    const hello = await connection.db.admin().command({ hello: 1 });
    assert.ok(hello.setName || hello.msg === 'isdbgrid', 'Transaction support required');
    const session = await connection.startSession();
    try {
      session.startTransaction();
      await connection.db.collection('users').findOne({}, { session, projection: { _id: 1 }, maxTimeMS: 5000 });
      await session.abortTransaction();
    } finally { await session.endSession(); }
    return { ping: true, readTransaction: true };
  } finally { await connection.close(); }
}

async function checkGemini() {
  assertConfigured();
  const contents = [{ role: 'user', parts: [{ text: 'Hãy gọi công cụ app_guide, rồi tóm tắt ngắn gọn chatbot FinanceFlow hỗ trợ những gì. Không truy vấn dữ liệu cá nhân.' }] }];
  const signal = AbortSignal.timeout(30000);
  let count = 0;
  for (let round = 0; round < 4; round++) {
    const response = await generate(contents, signal);
    const calls = response.parts.filter(p => p.functionCall).map(p => p.functionCall);
    if (!calls.length) {
      assert.ok(count > 0, 'Gemini must exercise function calling');
      assert.ok(response.parts.some(p => !p.thought && p.text?.trim()), 'Gemini must return a final answer');
      return { model: process.env.GEMINI_MODEL, toolCalls: count, finalAnswer: true };
    }
    assert.ok(count + calls.length <= 8, 'Too many tool calls');
    assert.ok(calls.every(c => c.name === 'app_guide'), 'Only the static guide may be used by this diagnostic');
    contents.push(response);
    const parts = [];
    for (const call of calls) {
      const result = await executeTool(null, call.name, call.args || {});
      count++;
      parts.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response: result } });
    }
    contents.push({ role: 'user', parts });
  }
  throw Object.assign(new Error(), { code: 'AI_TOOL_LIMIT' });
}

async function main() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
  const checks = [['mongodb', checkMongo], ['gemini', checkGemini]];
  const results = await Promise.allSettled(checks.map(([, check]) => check()));
  results.forEach((result, i) => {
    const ok = result.status === 'fulfilled';
    console.log(JSON.stringify({ check: checks[i][0], ok, ...(ok ? result.value : {
      code: typeof result.reason?.code === 'string' && /^[A-Z_]+$/.test(result.reason.code) ? result.reason.code : 'CHECK_FAILED',
      errorType: result.reason?.name === 'AssertionError' ? 'AssertionError' : 'ConnectionOrProviderError',
    }) }));
    if (!ok) process.exitCode = 1;
  });
}
if (require.main === module) main().catch(() => { console.error('Chat connectivity check failed.'); process.exitCode = 1; });
module.exports = { checkMongo, checkGemini };
