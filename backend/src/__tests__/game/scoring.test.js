const { calculateRoundScores, applyScores, getSortedLeaderboard } = require('../../game/scoring');

function makeRoom({ hasAI, aiPlayerName = 'Bot', roles, votes }) {
  return {
    hasAI,
    aiPlayerName,
    roles,
    votes,
    players: Object.keys(roles).map((name) => ({ name, isAI: false })),
    scores: {},
  };
}

// ─── hasAI = true ──────────────────────────────────────────────────────────

describe('calculateRoundScores — with AI', () => {
  const aiPlayerName = 'Bot';

  it('gives +3 to players who voted correctly for the AI', () => {
    const room = makeRoom({
      hasAI: true,
      aiPlayerName,
      roles: { Alice: 'human', Bob: 'human', Carlos: 'human' },
      votes: { Alice: 'Bot', Bob: 'Bot', Carlos: 'Alice' },
    });
    const delta = calculateRoundScores(room, 'Bot');
    expect(delta.Alice).toBe(3);
    expect(delta.Bob).toBe(3);
    expect(delta.Carlos).toBe(0);
  });

  it('gives +2 to robot-human who was not the most voted', () => {
    const room = makeRoom({
      hasAI: true,
      aiPlayerName,
      roles: { Alice: 'robot-human', Bob: 'human', Carlos: 'human' },
      votes: { Alice: 'Bot', Bob: 'Bot', Carlos: 'Bot' },
    });
    // mostVoted = Bot, Alice (robot-human) not most voted → +2, also voted correctly → +3
    const delta = calculateRoundScores(room, 'Bot');
    expect(delta.Alice).toBe(5); // +3 correct vote + +2 robot-human survived
  });

  it('does not give +2 to robot-human who WAS most voted', () => {
    const room = makeRoom({
      hasAI: true,
      aiPlayerName,
      roles: { Alice: 'robot-human', Bob: 'human', Carlos: 'human' },
      votes: { Alice: 'Bot', Bob: 'Alice', Carlos: 'Alice' },
    });
    // mostVoted = Alice, robot-human was most voted → no +2 bonus
    const delta = calculateRoundScores(room, 'Alice');
    expect(delta.Alice).toBe(3); // only +3 for correct vote on Bot
  });

  it('gives +3 to mole when AI won', () => {
    const room = makeRoom({
      hasAI: true,
      aiPlayerName,
      roles: { Alice: 'mole', Bob: 'human', Carlos: 'human' },
      votes: { Alice: 'Bob', Bob: 'Carlos', Carlos: 'Bob' },
    });
    // mostVoted = Bob, AI was not caught → mole gets +3
    const delta = calculateRoundScores(room, 'Bob');
    expect(delta.Alice).toBe(3);
  });

  it('gives 0 to mole when AI was caught', () => {
    const room = makeRoom({
      hasAI: true,
      aiPlayerName,
      roles: { Alice: 'mole', Bob: 'human', Carlos: 'human' },
      votes: { Alice: 'Bot', Bob: 'Bot', Carlos: 'Bot' },
    });
    // mostVoted = Bot → AI caught → mole gets 0
    const delta = calculateRoundScores(room, 'Bot');
    expect(delta.Alice).toBe(3); // +3 for correct vote, +0 for mole fail
  });
});

// ─── hasAI = false ─────────────────────────────────────────────────────────

describe('calculateRoundScores — paranoia round (no AI)', () => {
  it('gives +2 to players who voted for a real human', () => {
    const room = makeRoom({
      hasAI: false,
      roles: { Alice: 'human', Bob: 'human', Carlos: 'robot-human' },
      votes: { Alice: 'Bob', Bob: 'Alice', Carlos: 'Alice' },
    });
    const delta = calculateRoundScores(room, 'Carlos');
    expect(delta.Alice).toBe(2); // voted for Bob (human) → +2
    expect(delta.Bob).toBe(2);   // voted for Alice (human) → +2
  });

  it('gives -1 to players who voted for the robot-human', () => {
    const room = makeRoom({
      hasAI: false,
      roles: { Alice: 'human', Bob: 'human', Carlos: 'robot-human' },
      votes: { Alice: 'Carlos', Bob: 'Carlos', Carlos: 'Alice' },
    });
    const delta = calculateRoundScores(room, 'Carlos');
    expect(delta.Alice).toBe(-1);
    expect(delta.Bob).toBe(-1);
  });

  it('gives +3 to robot-human who was most voted', () => {
    const room = makeRoom({
      hasAI: false,
      roles: { Alice: 'human', Bob: 'human', Carlos: 'robot-human' },
      votes: { Alice: 'Carlos', Bob: 'Carlos', Carlos: 'Alice' },
    });
    const delta = calculateRoundScores(room, 'Carlos');
    expect(delta.Carlos).toBe(3);
  });

  it('gives 0 to robot-human who was NOT most voted', () => {
    const room = makeRoom({
      hasAI: false,
      roles: { Alice: 'human', Bob: 'human', Carlos: 'robot-human' },
      votes: { Alice: 'Bob', Bob: 'Alice', Carlos: 'Alice' },
    });
    const delta = calculateRoundScores(room, 'Alice');
    expect(delta.Carlos).toBe(0);
  });
});

// ─── applyScores ───────────────────────────────────────────────────────────

describe('applyScores', () => {
  it('adds delta to existing scores', () => {
    const room = { scores: { Alice: 5, Bob: 2 } };
    applyScores(room, { Alice: 3, Bob: -1 });
    expect(room.scores.Alice).toBe(8);
    expect(room.scores.Bob).toBe(1);
  });

  it('initializes score to 0 for new players before adding', () => {
    const room = { scores: {} };
    applyScores(room, { NewPlayer: 3 });
    expect(room.scores.NewPlayer).toBe(3);
  });

  it('handles negative totals', () => {
    const room = { scores: { Alice: 0 } };
    applyScores(room, { Alice: -1 });
    expect(room.scores.Alice).toBe(-1);
  });
});

// ─── getSortedLeaderboard ──────────────────────────────────────────────────

describe('getSortedLeaderboard', () => {
  it('returns players sorted by score descending', () => {
    const board = getSortedLeaderboard({ Alice: 3, Bob: 9, Carlos: 6 });
    expect(board[0].name).toBe('Bob');
    expect(board[1].name).toBe('Carlos');
    expect(board[2].name).toBe('Alice');
  });

  it('returns an empty array for empty scores', () => {
    expect(getSortedLeaderboard({})).toEqual([]);
  });

  it('each entry has name and score', () => {
    const board = getSortedLeaderboard({ Alice: 5 });
    expect(board[0]).toEqual({ name: 'Alice', score: 5 });
  });
});
