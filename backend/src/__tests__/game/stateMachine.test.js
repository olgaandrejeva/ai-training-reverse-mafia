const { canTransition, transition } = require('../../game/stateMachine');

function makeRoom(phase) {
  return { phase, startedAt: null, revealedAt: null };
}

describe('canTransition', () => {
  it('allows lobby → playing', () => {
    expect(canTransition(makeRoom('lobby'), 'playing')).toBe(true);
  });

  it('allows playing → voting', () => {
    expect(canTransition(makeRoom('playing'), 'voting')).toBe(true);
  });

  it('allows voting → reveal', () => {
    expect(canTransition(makeRoom('voting'), 'reveal')).toBe(true);
  });

  it('allows reveal → lobby', () => {
    expect(canTransition(makeRoom('reveal'), 'lobby')).toBe(true);
  });

  it('rejects skipping phases (lobby → voting)', () => {
    expect(canTransition(makeRoom('lobby'), 'voting')).toBe(false);
  });

  it('rejects going backwards (playing → lobby)', () => {
    expect(canTransition(makeRoom('playing'), 'lobby')).toBe(false);
  });

  it('rejects unknown target phase', () => {
    expect(canTransition(makeRoom('lobby'), 'unknown')).toBe(false);
  });
});

describe('transition', () => {
  it('updates the room phase', () => {
    const room = makeRoom('lobby');
    transition(room, 'playing');
    expect(room.phase).toBe('playing');
  });

  it('sets startedAt when transitioning to playing', () => {
    const room = makeRoom('lobby');
    transition(room, 'playing');
    expect(room.startedAt).toBeInstanceOf(Date);
  });

  it('sets revealedAt when transitioning to reveal', () => {
    const room = makeRoom('voting');
    transition(room, 'reveal');
    expect(room.revealedAt).toBeInstanceOf(Date);
  });

  it('throws on an invalid transition', () => {
    const room = makeRoom('lobby');
    expect(() => transition(room, 'reveal')).toThrow();
  });

  it('does not mutate the phase on a failed transition', () => {
    const room = makeRoom('lobby');
    try { transition(room, 'reveal'); } catch {}
    expect(room.phase).toBe('lobby');
  });
});
