# Frontend Implementation Suggestions

This document is a guide for the frontend team. It covers recommended screens, how to connect to the backend, and ideas to make the experience feel alive.

---

## Recommended Stack

**Next.js + Tailwind CSS** is the recommended choice for a hackathon:
- Fast to build, easy to deploy on Vercel in one click
- Built-in routing handles the multi-screen flow naturally
- Tailwind makes dark, moody UIs quick to style

For real-time communication, use **socket.io-client** — it pairs directly with the backend's Socket.io server.

---

## Screen Flow

```
Landing → Lobby → Secret Role Screen → Chat → Voting → Reveal
```

---

## Screen by Screen

### 1. Landing Screen
The entry point. Keep it minimal and atmospheric.

- A text input for the player's name
- A text input for the room ID (or a "Create Room" button that generates one)
- A "Join" button
- Tagline: *"Everyone is a suspect. Even you."*

**What it does:**
- On "Create Room" → `POST /api/rooms`
- On "Join" → connect via Socket.io with `join_room` event sending `{ roomId, playerName }`

---

### 2. Lobby Screen
Waiting room before the game starts. Shows who has joined.

- List of connected players (updates in real time via `player_joined` socket event)
- A "Start Game" button visible only to the host (the first player who created the room)
- Room ID displayed so others can share it

**What it does:**
- On "Start Game" → `POST /api/start-game` with the list of player names
- On success, receive `playerInstructions` — deliver each player their secret role privately (see next screen)

---

### 3. Secret Role Screen
Each player sees their own private role instruction. This is a critical moment — make it feel dramatic.

- Full-screen overlay, shown only to that player
- Display the role name and instruction text
- If the player is the **Mole**, show which player they must protect
- A "I understand" button to dismiss and enter the chat

**Suggested role names (from `roles.md`):**
- Regular Human → names like *Alex Carter, Jordan Mitchell*
- Paranoid → names like *Riley Sinclair, Morgan Vance*
- Fake Robot → names like *Unit-7B, Cipher-X*
- Fake Human (Claude) → names like *Chris Donovan, Jamie Ellis*

**Design tip:** Use a different background color per role to make the reveal feel personal — but make sure no one else can see another player's screen.

---

### 4. Chat Screen
The main gameplay screen. This is where the paranoia happens.

#### Layout suggestion
- **Left panel:** player list with names (Claude appears here as a normal player — no special indicator)
- **Center:** scrollable chat feed
- **Bottom:** message input + send button
- **Top right:** phase indicator and a "Start Voting" button (host only)

#### Features to implement
- **Public chat:** messages sent via `send_message` socket event, received via `new_message`
- **Private messages (DMs):** clicking a player's name opens a DM panel — send with `isPrivate: true, to: playerName`
- **Accusations:** a button next to each player's name that fires the `accuse` socket event — show a dramatic banner when someone is accused (received via `accusation` event)
- **Typing indicator:** fake one for Claude — show it randomly every 10–20 seconds to make Claude feel present even when not responding

#### Claude's responses
Claude's messages arrive via the same `new_message` socket event as everyone else's. The frontend should treat them identically — no special styling. The goal is that no one can tell which messages are Claude's.

---

### 5. Voting Screen
Triggered when the host calls `POST /api/start-voting`. The frontend should listen for the `phase_updated` socket event to auto-transition all players simultaneously.

- Show each player's name as a selectable card
- One vote per player — disable the button after voting
- Show a live count of how many players have voted (without showing who voted for whom)
- When all votes are in, the backend auto-transitions to reveal — listen for `phase_updated`

**What it does:**
- On vote → `POST /api/vote` with `{ voter, votedFor }`

---

### 6. Reveal Screen
The dramatic finale. Reveal everything one piece at a time for maximum effect — don't dump it all at once.

#### Suggested reveal sequence (animated, timed):
1. *"The votes are in..."* — 2 second pause
2. Show the vote tally (who got how many votes)
3. *"The most suspected player was: [name]"* — highlight them
4. *"Was there an AI?"* — dramatic pause
5. Reveal: **YES** or **NO**
6. If yes → reveal Claude's fake name and personality
7. Show all roles (who was what)
8. Show score delta for this round (+3, +2, etc. next to each name)
9. Show the updated leaderboard
10. "Next Round" button (host only) → `POST /api/next-round`

**Design tip:** Use the `claudeStressPeak` value from the reveal response to show a fun stat: *"Claude's stress peaked at 73/100 — it was sweating."*

---

## Real-Time Events to Handle

| Event | When it fires | What to do |
|---|---|---|
| `player_joined` | Someone joins the room | Update the player list |
| `new_message` | Any message (human or Claude) | Append to chat feed |
| `accusation` | Someone accuses another player | Show a dramatic banner: *"[X] is accusing [Y]!"* |
| `phase_updated` | Phase changes (playing → voting → reveal) | Auto-navigate all players to the next screen |
| `player_disconnected` | Someone drops | Show a notice in the chat |

---

## Atmosphere Tips

The frontend's job is to make players paranoid. A few ideas:

- **Dark theme** — deep blacks, muted greens or reds, monospace font for a surveillance/terminal feel
- **Message timestamps** — show them so players can notice if someone is responding "too fast" or "too slow"
- **Subtle animations** — a pulsing dot on Claude's name when it's "typing", slight flicker effects on the accusation banner
- **Sound design** — a low hum during chat, a sharp alert sound when someone is accused, an ominous tone when the reveal starts
- **No avatars** — everyone is just a name. Anonymity feeds the paranoia.
- **Stress meter easter egg** — don't show the stress meter during the game, but show it dramatically at reveal as *"The AI's heartbeat"*

---

## Connecting to the Backend

```js
// Install: npm install socket.io-client

import { io } from 'socket.io-client';

const socket = io('http://localhost:3000');

// Join a room
socket.emit('join_room', { roomId: 'friday-game', playerName: 'Alex' });

// Send a message
socket.emit('send_message', { text: 'I think it\'s Jordan...' });

// Send a private message
socket.emit('send_message', { text: 'psst — I think it\'s the AI', isPrivate: true, to: 'Morgan' });

// Accuse someone
socket.emit('accuse', { accused: 'Jordan' });

// Listen for new messages
socket.on('new_message', (message) => {
  console.log(`${message.from}: ${message.text}`);
});

// Listen for phase changes
socket.on('phase_updated', ({ phase }) => {
  // navigate to the correct screen based on phase
});
```

---

## API Quick Reference

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/rooms` | Create a room |
| `GET` | `/api/rooms` | List all rooms |
| `POST` | `/api/start-game` | Start the game, get role instructions |
| `POST` | `/api/start-voting` | Open voting phase |
| `POST` | `/api/vote` | Submit a vote |
| `GET` | `/api/reveal` | Get round results and scores |
| `POST` | `/api/next-round` | Reset for next round |
| `GET` | `/api/scores` | Get leaderboard and round history |
| `GET` | `/api/messages` | Get full message history |
