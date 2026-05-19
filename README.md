# Reverse Mafia — Pass the Turing Test

Everyone is told they might be the AI. One human is secretly instructed to act robotic. One Claude is told to act maximally human. Vote on who's the bot. Twist: sometimes there's no AI at all. Paranoia is the game.

---

## How It Works

### 1. Creating a Room

Anyone can create a game room by providing a name for it (like `"friday-game"`), or let the system generate a short random ID automatically. Rooms are independent — multiple games can run at the same time without interfering with each other.

Once created, a room starts in **lobby** phase, waiting for players.

---

### 2. Starting a Game

When everyone is ready, the host sends a list of player names to start the game. The backend then:

- **Secretly decides** whether Claude (the AI) will be in this round — 60% of the time it is, 40% of the time it's not. Players never know which scenario they're in.
- **Assigns a secret role** to each player and sends it privately — no one sees anyone else's role.
- **If Claude is playing**, it gets a fake human name (like "Alex" or "Jordan") and is added to the player list as if it were a real person. It also gets assigned a random personality for the round.

#### The four roles

| Role | What they're told |
|---|---|
| **Human** | Act naturally. Someone might be an AI — or no one might be. |
| **Robot-human** | You're human, but act slightly robotic: short answers, odd phrasing, literal interpretations. Don't reveal this. |
| **Mole** | You're human. Secretly protect player X at all costs — deflect suspicion toward others, vouch for them. You don't know they're an AI. |
| **AI (Claude)** | Act as human as possible. If caught, you lose. |

#### Claude's personalities (assigned randomly each round)

Anxious, overconfident, philosophical, sarcastic, excessively friendly, or suspicious of everyone.

---

### 3. Playing (Chat Phase)

Players chat freely. The backend supports:

- **Public messages** — visible to everyone in the room, including Claude.
- **Private messages (DMs)** — only the sender and recipient see them. Claude cannot read these.
- **Accusations** — a player can publicly accuse someone. This is broadcast to the whole room.

#### Claude's stress meter

Claude has a hidden stress level (0–100) that rises during the game:
- Someone **mentions** Claude's fake name in chat → +5
- Someone **publicly accuses** Claude → +20
- Someone **votes** for Claude → +15

This stress level is saved and shown at the end of the round, revealing how close Claude came to being caught.

---

### 4. Voting Phase

The host moves the game to voting when the chat is over. Each player submits one vote for whoever they think is the AI. Once **everyone has voted**, the game automatically moves to the reveal.

---

### 5. The Reveal

The backend exposes everything:

- Who each player actually was (their role)
- How everyone voted
- Who got the most votes
- Whether the AI won (Claude wins if it was **not** the most voted player)
- Each player's score for this round
- The updated leaderboard

---

### 6. Scoring

| What happened | Points |
|---|---|
| You voted for the AI correctly | +3 |
| You were the robot-human and weren't the most suspected | +2 |
| You were the mole and the AI survived | +3 |
| No AI this round — you voted for a real human (resisted paranoia) | +2 |
| No AI this round — you voted for the robot-human (got fooled) | -1 |
| You were the robot-human and fooled everyone into thinking you were the AI | +3 |

Scores accumulate across rounds. The leaderboard tracks total points and each round's history.

---

### 7. Next Round

After the reveal, the host can start a new round. The room resets — new roles, new AI decision, new chat — but **player names and scores carry over**. The game continues until the group decides to stop.

---

## Running the Game

There are **3 pieces** to run for a full session:

```
Ollama (port 11434)   ← local LLM
Backend (port 3000)   ← Express + Socket.io + bot (runs together)
Frontend              ← index.html opened in the browser
```

The bot is **not a separate service** — it runs inside the backend automatically.

---

### Step 1 — Ollama (skip if you have an Anthropic API key)

```bash
# First time: download the model (~2 GB)
ollama pull llama3.2:3b

# Then leave this running in its own terminal:
ollama serve
```

If you have an Anthropic API key, Ollama is not needed — the backend detects the key and uses it automatically.

---

### Step 2 — Backend

```bash
cd backend

# First time:
npm install

# Configure your API key (optional — only if using Anthropic):
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start:
npm run dev
```

You should see:

```
Server running on http://localhost:3000
[claude-bot] started — AI backend: ollama
```

---

### Step 3 — Frontend

Just open the file in a browser — no build step needed:

```bash
open frontend/index.html
```

To simulate multiple players, open the same file in **multiple tabs or browsers**.

---

### Playing a Round

| Step | Who | Action |
|---|---|---|
| 1 | All players | Open `index.html`, type an alias, click **INITIATE LINK** |
| 2 | Everyone | Wait in the lobby — see who has connected |
| 3 | Any player | Click **START EVALUATION** (minimum 3 players required) |
| 4 | Each player | See their secret role privately — it disappears after 5 seconds |
| 5 | Everyone | Chat freely for 4 minutes around the discussion prompt |
| 6 | Timer hits 0 | Voting opens automatically — 30 seconds to cast your vote |
| 7 | Everyone votes | Select who you think is the bot |
| 8 | Reveal | Roles, votes, and outcome are shown — did the AI win? |
| 9 | Next round | Click **INITIATE NEW EVALUATION** — scores carry over |

---

### Notes

- **All players share the same room** — the frontend uses `ROOM_ID = "default"` for everyone. Just open the same `index.html` and you're in.
- **The bot joins automatically** — when the backend assigns AI roles (60% chance), the bot starts responding in chat on its own.
- **Mock mode** — to test the frontend without a running backend, set `MOCK_MODE = true` on line 517 of `index.html`.
- **Run tests** — `cd backend && npm test`
