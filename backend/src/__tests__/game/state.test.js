const {
  createRoom,
  getRoom,
  getOrCreateRoom,
  deleteRoom,
  getAllRooms,
} = require('../../game/state');

// Reset rooms between tests by deleting everything created
afterEach(() => {
  const rooms = getAllRooms();
  Object.keys(rooms).forEach((id) => deleteRoom(id));
});

describe('createRoom', () => {
  it('creates a room with the correct initial state', () => {
    const room = createRoom('r1');
    expect(room.phase).toBe('lobby');
    expect(room.players).toEqual([]);
    expect(room.messages).toEqual([]);
    expect(room.votes).toEqual({});
    expect(room.scores).toEqual({});
    expect(room.rounds).toEqual([]);
    expect(room.currentRound).toBe(0);
    expect(room.hasAI).toBe(false);
    expect(room.claudeStress).toBe(0);
  });

  it('stores the room so getRoom can find it', () => {
    createRoom('r2');
    expect(getRoom('r2')).not.toBeNull();
  });
});

describe('getRoom', () => {
  it('returns null for a room that does not exist', () => {
    expect(getRoom('nonexistent')).toBeNull();
  });

  it('returns the room object when it exists', () => {
    createRoom('r3');
    const room = getRoom('r3');
    expect(room).toBeDefined();
    expect(room.phase).toBe('lobby');
  });
});

describe('getOrCreateRoom', () => {
  it('creates a new room if it does not exist', () => {
    const room = getOrCreateRoom('new-room');
    expect(room).toBeDefined();
    expect(room.phase).toBe('lobby');
  });

  it('returns the existing room without resetting it', () => {
    const room = createRoom('existing');
    room.phase = 'playing';
    const same = getOrCreateRoom('existing');
    expect(same.phase).toBe('playing');
  });
});

describe('deleteRoom', () => {
  it('removes the room', () => {
    createRoom('to-delete');
    deleteRoom('to-delete');
    expect(getRoom('to-delete')).toBeNull();
  });

  it('does not throw when deleting a non-existent room', () => {
    expect(() => deleteRoom('ghost')).not.toThrow();
  });
});

describe('getAllRooms', () => {
  it('returns all created rooms', () => {
    createRoom('a');
    createRoom('b');
    const all = getAllRooms();
    expect(all['a']).toBeDefined();
    expect(all['b']).toBeDefined();
  });

  it('returns an empty object when no rooms exist', () => {
    expect(getAllRooms()).toEqual({});
  });
});
