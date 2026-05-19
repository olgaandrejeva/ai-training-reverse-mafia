// AI backend module — used by the server to get the AI player's reply.
// Backend selection happens once at startup:
//   - LLM_BACKEND=anthropic|ollama  → forces a backend
//   - ANTHROPIC_API_KEY set         → uses Anthropic
//   - otherwise                     → uses Ollama
//
// Exports:
//   getAIReply(history, systemPrompt, aiPlayerName)  → Promise<string>
//   scheduleAIReply(history, systemPrompt, aiPlayerName, onReply, opts)
//   getBackendName()                                 → 'anthropic' | 'ollama'

'use strict';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434/api/chat';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';

function pickBackend() {
  const override = process.env.LLM_BACKEND;
  if (override === 'anthropic' || override === 'ollama') return override;
  return process.env.ANTHROPIC_API_KEY ? 'anthropic' : 'ollama';
}

const BACKEND = pickBackend();

function getBackendName() {
  return BACKEND;
}

// Collapse consecutive same-role messages — Anthropic rejects them, Ollama doesn't care.
function buildMessages(history, aiPlayerName) {
  const out = [];
  for (const m of history) {
    const role = m.playerName === aiPlayerName ? 'assistant' : 'user';
    const content = role === 'assistant' ? m.text : `${m.playerName}: ${m.text}`;
    if (out.length && out[out.length - 1].role === role) {
      out[out.length - 1].content += `\n${content}`;
    } else {
      out.push({ role, content });
    }
  }
  if (out.length === 0 || out[0].role !== 'user') {
    out.unshift({ role: 'user', content: '(chat just started)' });
  }
  return out;
}

async function callAnthropic(history, systemPrompt, aiPlayerName) {
  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 120,
      system: `${systemPrompt}\n\nYour name in this chat is ${aiPlayerName}.`,
      messages: buildMessages(history, aiPlayerName),
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content[0].text.trim();
}

async function callOllama(history, systemPrompt, aiPlayerName) {
  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: 'system', content: `${systemPrompt}\n\nYour name in this chat is ${aiPlayerName}.` },
        ...buildMessages(history, aiPlayerName),
      ],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message.content.trim();
}

async function getAIReply(history, systemPrompt, aiPlayerName) {
  return BACKEND === 'anthropic'
    ? callAnthropic(history, systemPrompt, aiPlayerName)
    : callOllama(history, systemPrompt, aiPlayerName);
}

// Module-level lock: at most one AI reply in flight (single in-memory game).
let aiReplyPending = false;

// Fire-and-forget. Returns true if a reply was scheduled, false if skipped.
// Skipped when: another reply is already pending, the AI just spoke, or the
// 40% probability gate didn't fire.
function scheduleAIReply(history, systemPrompt, aiPlayerName, onReply, opts = {}) {
  if (aiReplyPending) return false;
  const lastMsg = history[history.length - 1];
  if (lastMsg && lastMsg.playerName === aiPlayerName) return false;
  const probability = opts.probability ?? 0.4;
  if (Math.random() >= probability) return false;
  const minDelay = opts.minDelayMs ?? 1000;
  const maxDelay = opts.maxDelayMs ?? 3000;
  const delay = minDelay + Math.random() * (maxDelay - minDelay);
  aiReplyPending = true;
  setTimeout(async () => {
    try {
      const reply = await getAIReply(history, systemPrompt, aiPlayerName);
      if (reply) onReply(reply);
    } catch (err) {
      console.error(`[ai] reply failed via ${BACKEND}:`, err.message);
    } finally {
      aiReplyPending = false;
    }
  }, delay);
  return true;
}

module.exports = { getAIReply, scheduleAIReply, getBackendName };
