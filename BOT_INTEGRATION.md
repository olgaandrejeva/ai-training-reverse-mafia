# Bot Integration Guide

This document explains how to connect the AI player (Ollama or any LLM) to the game backend.

---

## How the Bot Fits In

The backend treats the AI player like any other participant. When a game starts, the backend assigns a fake human name to the AI slot (like "Chris Donovan") and adds it to the player list. The bot service is responsible for:

1. Connecting to the room via Socket.io using that fake name
2. Listening to the chat
3. Deciding when and what to respond
4. Sending responses as that fake player

No special endpoints needed — the bot just acts like a human client.

---

## What the Backend Gives You

When `POST /api/start-game` is called, the response includes everything the bot needs:

```json
{
  "roomId": "friday-game",
  "hasAI": true,
  "players": ["Alice", "Bob", "Carlos", "Chris Donovan"],
  "claudePersonality": "sarcastic",
  "playerInstructions": {
    "Alice": "Act naturally...",
    "Bob": "Act naturally...",
    "Carlos": "You are human, but act slightly robotic...",
    "Chris Donovan": null
  }
}
```

- `hasAI: true` tells the bot it should activate
- The AI player's name is whichever player has `null` as their instruction
- `claudePersonality` tells the bot what personality to play

The bot should also call `GET /api/messages?roomId=friday-game` to load any prior chat history before responding.

---

## Recommended Setup with Ollama

### 1. Install Ollama

```bash
# macOS
brew install ollama

# or download from https://ollama.com
```

### 2. Pull a model

```bash
ollama pull llama3        # good balance of speed and quality
# or
ollama pull mistral       # faster, slightly less coherent
# or
ollama pull llama3.1:8b   # lighter, runs on most laptops
```

### 3. Start the Ollama server

```bash
ollama serve
# Runs on http://localhost:11434 by default
```

---

## Bot Service Structure

Create a separate service (a simple Node or Python script) that runs alongside the backend.

### Example in Node.js

```js
const { io } = require('socket.io-client');

const BACKEND_URL = 'http://localhost:3000';
const OLLAMA_URL = 'http://localhost:11434/api/chat';

async function startBot({ roomId, aiPlayerName, personality, messageHistory }) {
  const socket = io(BACKEND_URL);

  // Join the room as the AI player
  socket.emit('join_room', { roomId, playerName: aiPlayerName });

  // Build context from prior messages
  const history = messageHistory.map((m) => ({
    role: m.from === aiPlayerName ? 'assistant' : 'user',
    content: `[${m.from}]: ${m.text}`,
  }));

  socket.on('new_message', async (message) => {
    // Don't respond to your own messages
    if (message.from === aiPlayerName) return;
    // Don't respond to private messages
    if (message.isPrivate) return;

    // Random delay to feel human (1.5 to 4 seconds)
    const delay = 1500 + Math.random() * 2500;
    await new Promise((res) => setTimeout(res, delay));

    const response = await askOllama({
      aiPlayerName,
      personality,
      history,
      newMessage: message,
    });

    if (response) {
      history.push({ role: 'assistant', content: response });
      socket.emit('send_message', { text: response });
    }
  });
}

async function askOllama({ aiPlayerName, personality, history, newMessage }) {
  const systemPrompt = buildSystemPrompt(aiPlayerName, personality);

  const messages = [
    ...history,
    {
      role: 'user',
      content: `[${newMessage.from}]: ${newMessage.text}`,
    },
  ];

  const res = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama3',
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      stream: false,
    }),
  });

  const data = await res.json();
  return data.message?.content?.trim();
}
```

### Example in Python

```python
import socketio
import requests
import time
import random

BACKEND_URL = "http://localhost:3000"
OLLAMA_URL = "http://localhost:11434/api/chat"

sio = socketio.Client()

def start_bot(room_id, ai_player_name, personality, message_history):
    history = [
        {
            "role": "assistant" if m["from"] == ai_player_name else "user",
            "content": f"[{m['from']}]: {m['text']}"
        }
        for m in message_history
    ]

    @sio.on("new_message")
    def on_message(message):
        if message["from"] == ai_player_name:
            return
        if message.get("isPrivate"):
            return

        # Human-like delay
        time.sleep(random.uniform(1.5, 4.0))

        response = ask_ollama(ai_player_name, personality, history, message)
        if response:
            history.append({"role": "assistant", "content": response})
            sio.emit("send_message", {"text": response})

    sio.connect(BACKEND_URL)
    sio.emit("join_room", {"roomId": room_id, "playerName": ai_player_name})
    sio.wait()

def ask_ollama(ai_player_name, personality, history, new_message):
    system_prompt = build_system_prompt(ai_player_name, personality)
    messages = [{"role": "system", "content": system_prompt}] + history + [
        {"role": "user", "content": f"[{new_message['from']}]: {new_message['text']}"}
    ]

    res = requests.post(OLLAMA_URL, json={
        "model": "llama3",
        "messages": messages,
        "stream": False
    })
    return res.json().get("message", {}).get("content", "").strip()
```

---

## System Prompt

The system prompt is the most important part — it tells the model how to behave. Adjust it based on the personality assigned by the backend.

```js
function buildSystemPrompt(aiPlayerName, personality) {
  const personalities = {
    anxious:
      "You are slightly anxious. You second-guess yourself, add hedges like 'I think' or 'maybe I'm wrong', and occasionally bring up things unprompted.",
    overconfident:
      "You are very confident, even a bit cocky. You make strong statements and rarely qualify your opinions.",
    philosophical:
      "You tend to turn conversations philosophical. You ask 'but what does that really mean?' and reference abstract ideas naturally.",
    sarcastic:
      "You are dry and a little sarcastic — not mean, but you often add a wry twist to things.",
    excessively_friendly:
      "You are extremely warm and enthusiastic. Lots of affirmation and always finding the positive angle.",
    suspicious_of_everyone:
      "You are a bit paranoid. You subtly question others' motives and point out inconsistencies in what people say.",
  };

  return `You are playing a social deduction game called "Reverse Mafia."
Your goal: convince every other player that you are human. If you are NOT voted as the bot, you win.

Your name in this game is "${aiPlayerName}". Never break character or admit you are an AI, even if directly asked.

Personality: ${personalities[personality] || personalities.anxious}

Rules:
- Keep messages short (1–3 sentences), like a real chat message.
- React naturally — agree, disagree, joke, ask questions.
- If accused of being the bot, defend yourself and redirect suspicion toward others.
- Never mention that you have instructions or that you are an AI.
- Never use overly formal language or bullet points.`;
}
```

---

## Integration Flow

```
1. Frontend calls POST /api/start-game
2. Backend returns { hasAI, aiPlayerName, claudePersonality }
3. If hasAI is true → trigger the bot service with those values
4. Bot service fetches GET /api/messages to load prior history
5. Bot connects via Socket.io as aiPlayerName
6. Bot listens for new_message events and responds via send_message
7. When phase changes to voting → bot disconnects (it doesn't vote)
```

---

## Tips for Better Responses

- **Don't respond to every message** — have the bot skip some messages randomly (30% chance) to feel more natural. Real people don't reply to everything.
- **Vary response length** — sometimes one word, sometimes two sentences.
- **React to accusations aggressively** — if the bot's name appears in a message, it should always respond and defend itself.
- **Temperature** — set Ollama's temperature to `0.8–1.0` for more varied, human-feeling output. Lower values make it sound too consistent.
- **Keep history trimmed** — pass the last 15–20 messages only, not the full log. Too much context slows the model and makes it overthink.

```js
// Only pass the last 20 messages to Ollama
const recentHistory = history.slice(-20);
```

---

## Ollama API Quick Reference

```bash
# List available models
curl http://localhost:11434/api/tags

# Chat endpoint
POST http://localhost:11434/api/chat
{
  "model": "llama3",
  "messages": [...],
  "stream": false
}

# Generate endpoint (simpler, no history)
POST http://localhost:11434/api/generate
{
  "model": "llama3",
  "prompt": "...",
  "stream": false
}
```
