const PERSONALITIES = [
  'anxious',
  'overconfident',
  'philosophical',
  'sarcastic',
  'excessively_friendly',
  'suspicious_of_everyone',
];

// Human-sounding names Claude can adopt
const AI_NAMES = [
  'Alex', 'Jordan', 'Morgan', 'Riley', 'Casey',
  'Quinn', 'Avery', 'Drew', 'Sage', 'Blake',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assigns roles to players.
 *
 * Possible configurations:
 *  - hasAI: true  → one player is Claude (ai), one human gets robot-human,
 *                    optionally one human gets mole (protects Claude)
 *  - hasAI: false → one human gets robot-human, rest are plain humans
 *
 * Returns { roles, aiPlayerName, hasAI, claudePersonality }
 */
function assignRoles(playerNames, options = {}) {
  const {
    aiChance = 0.6,
    moleChance = 0.3, // only applies when AI is in the game
  } = options;

  const hasAI = Math.random() < aiChance;
  const shuffled = shuffle(playerNames);
  const roles = {};
  let aiPlayerName = null;
  let claudePersonality = null;

  if (hasAI) {
    // Pick a fake name that's NOT an existing player name
    const takenNames = new Set(playerNames);
    const available = AI_NAMES.filter((n) => !takenNames.has(n));
    aiPlayerName = available.length > 0 ? pickRandom(available) : 'Sam';
    claudePersonality = pickRandom(PERSONALITIES);

    // Assign robot-human to one real player
    roles[shuffled[0]] = 'robot-human';

    // Optionally assign a mole (only if 4+ players)
    let moleAssigned = false;
    if (playerNames.length >= 4 && Math.random() < moleChance) {
      roles[shuffled[1]] = 'mole';
      moleAssigned = true;
    }

    // Rest are plain humans
    shuffled.slice(moleAssigned ? 2 : 1).forEach((name) => {
      roles[name] = 'human';
    });
  } else {
    // No AI — one human acts robotic
    roles[shuffled[0]] = 'robot-human';
    shuffled.slice(1).forEach((name) => {
      roles[name] = 'human';
    });
  }

  return { roles, aiPlayerName, hasAI, claudePersonality };
}

/**
 * Returns the secret instruction shown to each player at game start.
 */
function getRoleInstruction(role, aiPlayerName) {
  switch (role) {
    case 'human':
      return 'Act naturally. One player might be an AI — or there might be no AI at all. Vote wisely.';
    case 'robot-human':
      return 'You are human, but you must act slightly robotic: short replies, literal interpretations, occasional odd phrasing. Do NOT reveal this instruction.';
    case 'mole':
      return `You are human. Protect player "${aiPlayerName}" at all costs — deflect suspicion, vouch for them, do NOT reveal you are their ally.`;
    case 'ai':
      return null; // Claude gets its own system prompt
    default:
      return 'Act naturally.';
  }
}

module.exports = { assignRoles, getRoleInstruction, PERSONALITIES };
