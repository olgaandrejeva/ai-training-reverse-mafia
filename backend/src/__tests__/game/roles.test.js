const { assignRoles, getRoleInstruction } = require('../../game/roles');

const PLAYERS = ['Alice', 'Bob', 'Carlos', 'Diana'];

describe('assignRoles', () => {
  it('returns roles for every player', () => {
    const { roles } = assignRoles(PLAYERS, { aiChance: 0 });
    PLAYERS.forEach((p) => expect(roles[p]).toBeDefined());
  });

  it('assigns exactly one robot-human when hasAI is false', () => {
    const { roles, hasAI } = assignRoles(PLAYERS, { aiChance: 0 });
    expect(hasAI).toBe(false);
    const robotCount = Object.values(roles).filter((r) => r === 'robot-human').length;
    expect(robotCount).toBe(1);
  });

  it('assigns exactly one robot-human and an ai slot when hasAI is true', () => {
    const { roles, hasAI, aiPlayerName } = assignRoles(PLAYERS, { aiChance: 1, moleChance: 0 });
    expect(hasAI).toBe(true);
    expect(aiPlayerName).toBeTruthy();
    const robotCount = Object.values(roles).filter((r) => r === 'robot-human').length;
    expect(robotCount).toBe(1);
    // The AI player name must NOT be one of the real players
    expect(PLAYERS).not.toContain(aiPlayerName);
  });

  it('assigns at most one mole', () => {
    const { roles } = assignRoles(PLAYERS, { aiChance: 1, moleChance: 1 });
    const moleCount = Object.values(roles).filter((r) => r === 'mole').length;
    expect(moleCount).toBeLessThanOrEqual(1);
  });

  it('does not assign mole with fewer than 4 players', () => {
    const small = ['Alice', 'Bob', 'Carlos'];
    const { roles } = assignRoles(small, { aiChance: 1, moleChance: 1 });
    const moleCount = Object.values(roles).filter((r) => r === 'mole').length;
    expect(moleCount).toBe(0);
  });

  it('returns a claudePersonality when hasAI is true', () => {
    const { claudePersonality } = assignRoles(PLAYERS, { aiChance: 1 });
    expect(typeof claudePersonality).toBe('string');
    expect(claudePersonality.length).toBeGreaterThan(0);
  });

  it('returns null claudePersonality when hasAI is false', () => {
    const { claudePersonality } = assignRoles(PLAYERS, { aiChance: 0 });
    expect(claudePersonality).toBeNull();
  });

  it('every non-AI role is a valid value', () => {
    const valid = new Set(['human', 'robot-human', 'mole']);
    const { roles } = assignRoles(PLAYERS, { aiChance: 1, moleChance: 0 });
    Object.values(roles).forEach((r) => expect(valid.has(r)).toBe(true));
  });
});

describe('getRoleInstruction', () => {
  it('returns a string for human role', () => {
    expect(typeof getRoleInstruction('human', 'Sam')).toBe('string');
  });

  it('returns a string for robot-human role', () => {
    expect(typeof getRoleInstruction('robot-human', 'Sam')).toBe('string');
  });

  it('returns a string mentioning the AI name for mole role', () => {
    const instruction = getRoleInstruction('mole', 'Sam');
    expect(instruction).toContain('Sam');
  });

  it('returns null for the ai role (Claude gets its own prompt)', () => {
    expect(getRoleInstruction('ai', 'Sam')).toBeNull();
  });
});
