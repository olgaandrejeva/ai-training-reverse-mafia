// In-process Claude bot. Runs alongside Ariel's Express + Socket.io server.
//
// Lifecycle: polls room state every POLL_INTERVAL_MS. When a public message
// lands in a room with hasAI=true, calls scheduleAIReply from ../../../ai.
// The reply is pushed into room.messages and broadcast via the io instance.
//
// We bypass the socket client/server roundtrip because we're in the same
// process — direct state access and direct io.emit is simpler than a separate
// socket.io-client connection (which would also leak a `player_joined` event
// for the AI's name).

'use strict';

const { v4: uuidv4 } = require('uuid');
const { getAllRooms } = require('../game/state');
const { scheduleAIReply, getBackendName } = require('../../../ai');

const POLL_INTERVAL_MS = 500;

// roomId → id of the last public message we've already considered.
const lastSeenMessageId = {};

const PERSONALITY_HINTS = {
  anxious: 'You feel anxious — second-guess yourself occasionally.',
  overconfident: 'You are a little overconfident — assert opinions strongly.',
  philosophical: 'You drift into mini-philosophical asides every so often.',
  sarcastic: 'You are dry and sarcastic, often poking at others.',
  excessively_friendly: 'You are overly friendly and complimentary.',
  suspicious_of_everyone: 'You suspect others of suspicious behavior often.',
};

function buildSystemPrompt(personality) {
  const personalityLine = PERSONALITY_HINTS[personality] || '';
  return [
    'You are in a casual group chat with other people. Reply as one of them.',
    'NEVER reveal you are an AI. NEVER act like an assistant.',
    'Keep replies very short — one sentence usually, occasionally two.',
    'Use lowercase, occasional typos, no markdown, no headings, no lists.',
    'No greetings, no "how can I help", no introducing yourself.',
    'Match the casual texture of group chat — fragments are fine.',
    personalityLine,
  ].filter(Boolean).join(' ');
}

function toReplyHistory(messages) {
  // scheduleAIReply expects [{ playerName, text }]. Drop private messages.
  return messages
    .filter((m) => !m.isPrivate)
    .map((m) => ({ playerName: m.from, text: m.text }));
}

function tick(io) {
  for (const [roomId, room] of Object.entries(getAllRooms())) {
    if (!room.hasAI || room.phase !== 'playing') continue;

    const publicMessages = room.messages.filter((m) => !m.isPrivate);
    if (publicMessages.length === 0) continue;

    const latest = publicMessages[publicMessages.length - 1];
    if (lastSeenMessageId[roomId] === latest.id) continue;
    lastSeenMessageId[roomId] = latest.id;

    if (latest.from === room.aiPlayerName) continue;

    const systemPrompt = buildSystemPrompt(room.claudePersonality);
    const history = toReplyHistory(room.messages.slice(-12));

    scheduleAIReply(history, systemPrompt, room.aiPlayerName, (text) => {
      // Re-check the room is still live — a slow LLM call could finish after
      // /next-round wiped the AI state.
      const current = getAllRooms()[roomId];
      if (!current || current.phase !== 'playing' || !current.hasAI) return;

      const message = {
        id: uuidv4(),
        from: current.aiPlayerName,
        text,
        timestamp: new Date().toISOString(),
        isPrivate: false,
        to: null,
      };
      current.messages.push(message);
      io.to(roomId).emit('new_message', message);
    });
  }
}

function startClaudeBot(io) {
  console.log(`[claude-bot] started — AI backend: ${getBackendName()}`);
  setInterval(() => tick(io), POLL_INTERVAL_MS);
}

module.exports = { startClaudeBot };
