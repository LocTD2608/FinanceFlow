const { generate, assertConfigured } = require('../src/services/chat/gemini');
const originalFetch = global.fetch;
beforeEach(() => { process.env.GEMINI_API_KEY = 'test-secret'; process.env.GEMINI_MODEL = 'gemini-2.5-flash'; });
afterEach(() => { global.fetch = originalFetch; delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; });
const response = body => new Response(JSON.stringify(body), { status: 200 });
test('requires server key and explicit model', () => {
  delete process.env.GEMINI_API_KEY;
  expect(assertConfigured).toThrow('Gemini');
});
test('uses key header, fixed host and preserves thought signatures', async () => {
  const content = { role: 'model', parts: [{ functionCall: { name: 'app_guide', args: {} }, thoughtSignature: 'signature' }] };
  global.fetch = jest.fn().mockResolvedValue(response({ candidates: [{ content, finishReason: 'STOP' }] }));
  expect(await generate([{ role: 'user', parts: [{ text: 'hello' }] }], new AbortController().signal)).toEqual(content);
  expect(global.fetch.mock.calls[0][0]).not.toContain('test-secret');
  expect(global.fetch.mock.calls[0][1].headers['x-goog-api-key']).toBe('test-secret');
});
test.each([429, 500, 403])('sanitizes upstream status %s', async status => {
  global.fetch = jest.fn().mockResolvedValue(new Response('test-secret', { status }));
  await expect(generate([], new AbortController().signal)).rejects.toMatchObject({ status: status === 429 ? 429 : 503 });
});
test('model not found identifies server model configuration without exposing upstream body', async () => {
  global.fetch = jest.fn().mockResolvedValue(new Response('test-secret', { status: 404 }));
  await expect(generate([], new AbortController().signal)).rejects.toMatchObject({ status: 503, code: 'AI_MODEL_UNAVAILABLE' });
});
test('rejects empty, truncated and malformed responses', async () => {
  for (const body of [{}, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'half' }] } }] }]) {
    global.fetch = jest.fn().mockResolvedValue(response(body));
    await expect(generate([], new AbortController().signal)).rejects.toMatchObject({ status: 502 });
  }
});
