// Smoke test for ai.js — exercises whichever backend is active.
// Run: `node hello-ai.js`
//
//   ANTHROPIC_API_KEY=sk-ant-... node hello-ai.js   # uses Anthropic
//   node hello-ai.js                                # uses Ollama
//   LLM_BACKEND=ollama node hello-ai.js             # forces Ollama

const { getAIReply, getBackendName } = require('./ai');

(async () => {
  console.log(`Active backend: ${getBackendName()}`);

  const history = [
    { playerName: 'Alex', text: 'hey what did everyone have for lunch' },
    { playerName: 'Sam', text: 'leftover pasta lol' },
  ];
  const systemPrompt = 'You are a casual chatter in a group chat. Reply in one short sentence, lowercase, no punctuation, no markdown, no greetings.';
  const aiPlayerName = 'Jordan';

  const t0 = Date.now();
  try {
    const reply = await getAIReply(history, systemPrompt, aiPlayerName);
    console.log(`Reply: ${reply}`);
    console.log(`Latency: ${Date.now() - t0}ms`);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
})();
