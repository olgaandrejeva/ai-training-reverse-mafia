# Reverse Mafia — How the Backend Works

## 1. Creating a Room

Anyone can create a game room by providing a name for it (like `"friday-game"`), or let the system generate a short random ID automatically. Rooms are independent — multiple games can run at the same time without interfering with each other.

Once created, a room starts in **lobby** phase, waiting for players.

---

## 2. Starting a Game

When everyone is ready, the host sends a list of player names to start the game. The backend then:

- **Secretly decides** whether Claude (the AI) will be in this round — 60% of the time it is, 40% of the time it's not. Players never know which scenario they're in.
- **Assigns a secret role** to each player and sends it privately — no one sees anyone else's role.
- **If Claude is playing**, it gets a fake human name (like "Alex" or "Jordan") and is added to the player list as if it were a real person. It also gets assigned a random personality for the round.

### The four roles

| Role | What they're told |
|---|---|
| **Human** | Act naturally. Someone might be an AI — or no one might be. |
| **Robot-human** | You're human, but act slightly robotic: short answers, odd phrasing, literal interpretations. Don't reveal this. |
| **Mole** | You're human. Secretly protect player X at all costs — deflect suspicion toward others, vouch for them. You don't know they're an AI. |
| **AI (Claude)** | Act as human as possible. If caught, you lose. |

### Claude's personalities (assigned randomly each round)

Anxious, overconfident, philosophical, sarcastic, excessively friendly, or suspicious of everyone.

---

## 3. Playing (Chat Phase)

Players chat freely. The backend supports:

- **Public messages** — visible to everyone in the room, including Claude.
- **Private messages (DMs)** — only the sender and recipient see them. Claude cannot read these.
- **Accusations** — a player can publicly accuse someone. This is broadcast to the whole room.

### Claude's stress meter

Claude has a hidden stress level (0–100) that rises during the game:
- Someone **mentions** Claude's fake name in chat → +5
- Someone **publicly accuses** Claude → +20
- Someone **votes** for Claude → +15

This stress level is saved and shown at the end of the round, revealing how close Claude came to being caught.

---

## 4. Voting Phase

The host moves the game to voting when the chat is over. Each player submits one vote for whoever they think is the AI. Once **everyone has voted**, the game automatically moves to the reveal.

---

## 5. The Reveal

The backend exposes everything:

- Who each player actually was (their role)
- How everyone voted
- Who got the most votes
- Whether the AI won (Claude wins if it was **not** the most voted player)
- Each player's score for this round
- The updated leaderboard

---

## 6. Scoring

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

## 7. Next Round

After the reveal, the host can start a new round. The room resets — new roles, new AI decision, new chat — but **player names and scores carry over**. The game continues until the group decides to stop.
