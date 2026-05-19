const PHASES = ['lobby', 'playing', 'voting', 'reveal'];

const VALID_TRANSITIONS = {
  lobby: ['playing'],
  playing: ['voting'],
  voting: ['reveal'],
  reveal: ['lobby'],
};

function canTransition(room, toPhase) {
  return VALID_TRANSITIONS[room.phase]?.includes(toPhase) ?? false;
}

function transition(room, toPhase) {
  if (!canTransition(room, toPhase)) {
    throw new Error(`Invalid transition: ${room.phase} → ${toPhase}`);
  }
  room.phase = toPhase;

  if (toPhase === 'playing') room.startedAt = new Date();
  if (toPhase === 'reveal') room.revealedAt = new Date();
}

module.exports = { PHASES, canTransition, transition };
