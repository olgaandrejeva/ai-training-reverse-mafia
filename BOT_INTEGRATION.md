# Bot Integration — Where Ollama Enters the Backend

The AI module (`ai.js`) is already built. It handles both Ollama and Anthropic and exposes two functions:

- `scheduleAIReply(history, systemPrompt, aiPlayerName, onReply)` — the main one to use. Fire-and-forget, adds a human-like delay, skips if a reply is already pending.
- `getAIReply(history, systemPrompt, aiPlayerName)` — direct async call, no delay logic.

For setup instructions (installing Ollama, pulling a model, env vars) see [`LLM.md`](LLM.md).

---

## The one integration point: `backend/src/sockets/index.js`

The bot should be triggered inside the `send_message` socket handler, right after a new message is stored. When the AI is active in the room (`room.hasAI === true`), call `scheduleAIReply` and broadcast whatever it returns as a new message from the AI player.

```js
const { scheduleAIReply } = require('../../../ai');
const GAME_CONTENT = require('../../../content');

socket.on('send_message', ({ text, isPrivate = false, to = null }) => {
  const { roomId, playerName } = socket.data;
  const room = getRoom(roomId);

  if (!room || room.phase !== 'playing') return;

  // Store and broadcast the human message (existing logic)
  const message = { id: uuidv4(), from: playerName, text, timestamp: new Date().toISOString(), isPrivate, to };
  room.messages.push(message);
  io.to(roomId).emit('new_message', message);

  // Trigger AI reply — only on public messages when AI is in the game
  if (room.hasAI && !isPrivate) {
    const history = room.messages
      .filter((m) => !m.isPrivate)
      .map((m) => ({ playerName: m.from, text: m.text }));

    scheduleAIReply(history, GAME_CONTENT.systemPrompt, room.aiPlayerName, (reply) => {
      const aiMessage = {
        id: uuidv4(),
        from: room.aiPlayerName,
        text: reply,
        timestamp: new Date().toISOString(),
        isPrivate: false,
        to: null,
      };
      room.messages.push(aiMessage);
      io.to(roomId).emit('new_message', aiMessage);
    });
  }
});
```

That's it. The AI player's response arrives via the same `new_message` event as every other message — the frontend doesn't need to know it came from Ollama.

---

## What to pass as `systemPrompt`

The system prompt should come from `content.js`. Add a `systemPrompt` field there (or build it dynamically using the `claudePersonality` assigned by the backend at game start):

```js
// content.js — add this field
systemPrompt: `You are a player in a group chat game called Reverse Mafia.
Act like a casual human. Reply in 1–2 short sentences.
No markdown, no greetings, no bullet points. Lowercase is fine.
If someone accuses you of being a bot, deny it and deflect.`
```

To use the personality from the room state:

```js
const { PERSONALITIES } = require('../game/roles'); // already defined there

function buildSystemPrompt(personality) {
  const base = GAME_CONTENT.systemPrompt;
  const flavor = PERSONALITIES[personality] ?? '';
  return `${base}\n\nPersonality: ${flavor}`;
}

// Then pass it:
scheduleAIReply(history, buildSystemPrompt(room.claudePersonality), room.aiPlayerName, onReply);
```
