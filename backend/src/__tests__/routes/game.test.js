const request = require('supertest');
const express = require('express');
const gameRoutes = require('../../routes/game');
const { getAllRooms, deleteRoom } = require('../../game/state');

// Minimal Express app for route tests (no socket.io needed)
const app = express();
app.use(express.json());
app.use('/api', gameRoutes);

afterEach(() => {
  Object.keys(getAllRooms()).forEach((id) => deleteRoom(id));
});

// ─── POST /api/rooms ────────────────────────────────────────────────────────

describe('POST /api/rooms', () => {
  it('creates a room with a given roomId', async () => {
    const res = await request(app).post('/api/rooms').send({ roomId: 'test-room' });
    expect(res.status).toBe(201);
    expect(res.body.roomId).toBe('test-room');
    expect(res.body.phase).toBe('lobby');
  });

  it('auto-generates a roomId when none is provided', async () => {
    const res = await request(app).post('/api/rooms').send({});
    expect(res.status).toBe(201);
    expect(typeof res.body.roomId).toBe('string');
    expect(res.body.roomId.length).toBeGreaterThan(0);
  });

  it('returns 409 when the room already exists', async () => {
    await request(app).post('/api/rooms').send({ roomId: 'dup' });
    const res = await request(app).post('/api/rooms').send({ roomId: 'dup' });
    expect(res.status).toBe(409);
  });
});

// ─── GET /api/rooms ─────────────────────────────────────────────────────────

describe('GET /api/rooms', () => {
  it('returns an empty list when no rooms exist', async () => {
    const res = await request(app).get('/api/rooms');
    expect(res.status).toBe(200);
    expect(res.body.rooms).toEqual([]);
  });

  it('lists all created rooms', async () => {
    await request(app).post('/api/rooms').send({ roomId: 'r1' });
    await request(app).post('/api/rooms').send({ roomId: 'r2' });
    const res = await request(app).get('/api/rooms');
    const ids = res.body.rooms.map((r) => r.roomId);
    expect(ids).toContain('r1');
    expect(ids).toContain('r2');
  });
});

// ─── POST /api/start-game ───────────────────────────────────────────────────

describe('POST /api/start-game', () => {
  beforeEach(async () => {
    await request(app).post('/api/rooms').send({ roomId: 'game' });
  });

  it('starts the game and moves to playing phase', async () => {
    const res = await request(app)
      .post('/api/start-game')
      .send({ roomId: 'game', players: ['Alice', 'Bob', 'Carlos'] });
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe('playing');
  });

  it('returns a private instruction for each player', async () => {
    const players = ['Alice', 'Bob', 'Carlos'];
    const res = await request(app)
      .post('/api/start-game')
      .send({ roomId: 'game', players });
    players.forEach((p) => {
      expect(res.body.playerInstructions[p]).toBeDefined();
    });
  });

  it('increments currentRound on each start', async () => {
    const first = await request(app)
      .post('/api/start-game')
      .send({ roomId: 'game', players: ['Alice', 'Bob', 'Carlos'] });
    expect(first.body.currentRound).toBe(1);
  });

  it('rejects fewer than 3 players', async () => {
    const res = await request(app)
      .post('/api/start-game')
      .send({ roomId: 'game', players: ['Alice', 'Bob'] });
    expect(res.status).toBe(400);
  });

  it('rejects starting when not in lobby phase', async () => {
    await request(app)
      .post('/api/start-game')
      .send({ roomId: 'game', players: ['Alice', 'Bob', 'Carlos'] });
    const res = await request(app)
      .post('/api/start-game')
      .send({ roomId: 'game', players: ['Alice', 'Bob', 'Carlos'] });
    expect(res.status).toBe(400);
  });
});

// ─── POST /api/start-voting ─────────────────────────────────────────────────

describe('POST /api/start-voting', () => {
  beforeEach(async () => {
    await request(app).post('/api/rooms').send({ roomId: 'v' });
    await request(app)
      .post('/api/start-game')
      .send({ roomId: 'v', players: ['Alice', 'Bob', 'Carlos'] });
  });

  it('transitions to voting phase', async () => {
    const res = await request(app).post('/api/start-voting').send({ roomId: 'v' });
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe('voting');
  });

  it('returns 404 for an unknown room', async () => {
    const res = await request(app).post('/api/start-voting').send({ roomId: 'ghost' });
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/vote ─────────────────────────────────────────────────────────

describe('POST /api/vote', () => {
  const players = ['Alice', 'Bob', 'Carlos'];

  async function setupVoting() {
    await request(app).post('/api/rooms').send({ roomId: 'vv' });
    await request(app).post('/api/start-game').send({ roomId: 'vv', players });
    await request(app).post('/api/start-voting').send({ roomId: 'vv' });
  }

  beforeEach(setupVoting);

  it('records a vote', async () => {
    const res = await request(app)
      .post('/api/vote')
      .send({ roomId: 'vv', voter: 'Alice', votedFor: 'Bob' });
    expect(res.status).toBe(200);
    expect(res.body.voter).toBe('Alice');
    expect(res.body.votedFor).toBe('Bob');
  });

  it('auto-advances to reveal when all players have voted', async () => {
    // Get the player list from the room (may include AI player)
    const roomsRes = await request(app).get('/api/rooms');
    const room = roomsRes.body.rooms.find((r) => r.roomId === 'vv');
    const realPlayers = room.players;

    for (const voter of realPlayers) {
      await request(app)
        .post('/api/vote')
        .send({ roomId: 'vv', voter, votedFor: realPlayers[(realPlayers.indexOf(voter) + 1) % realPlayers.length] });
    }

    const revealRes = await request(app).get('/api/reveal?roomId=vv');
    expect(revealRes.status).toBe(200);
  });

  it('returns 400 when not in voting phase', async () => {
    await request(app).post('/api/rooms').send({ roomId: 'notvoting' });
    await request(app).post('/api/start-game').send({ roomId: 'notvoting', players });
    const res = await request(app)
      .post('/api/vote')
      .send({ roomId: 'notvoting', voter: 'Alice', votedFor: 'Bob' });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/reveal ────────────────────────────────────────────────────────

describe('GET /api/reveal', () => {
  const players = ['Alice', 'Bob', 'Carlos'];

  async function setupReveal() {
    await request(app).post('/api/rooms').send({ roomId: 'rev' });
    await request(app).post('/api/start-game').send({ roomId: 'rev', players });
    await request(app).post('/api/start-voting').send({ roomId: 'rev' });

    const roomsRes = await request(app).get('/api/rooms');
    const room = roomsRes.body.rooms.find((r) => r.roomId === 'rev');
    for (const voter of room.players) {
      await request(app)
        .post('/api/vote')
        .send({ roomId: 'rev', voter, votedFor: room.players[(room.players.indexOf(voter) + 1) % room.players.length] });
    }
  }

  beforeEach(setupReveal);

  it('returns reveal data with required fields', async () => {
    const res = await request(app).get('/api/reveal?roomId=rev');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('hasAI');
    expect(res.body).toHaveProperty('tally');
    expect(res.body).toHaveProperty('mostVoted');
    expect(res.body).toHaveProperty('scoreDelta');
    expect(res.body).toHaveProperty('leaderboard');
  });

  it('returns 400 when not yet in reveal phase', async () => {
    await request(app).post('/api/rooms').send({ roomId: 'notrev' });
    await request(app).post('/api/start-game').send({ roomId: 'notrev', players });
    const res = await request(app).get('/api/reveal?roomId=notrev');
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown room', async () => {
    const res = await request(app).get('/api/reveal?roomId=ghost');
    expect(res.status).toBe(404);
  });
});

// ─── POST /api/next-round ───────────────────────────────────────────────────

describe('POST /api/next-round', () => {
  const players = ['Alice', 'Bob', 'Carlos'];

  async function setupNextRound() {
    await request(app).post('/api/rooms').send({ roomId: 'nr' });
    await request(app).post('/api/start-game').send({ roomId: 'nr', players });
    await request(app).post('/api/start-voting').send({ roomId: 'nr' });

    const roomsRes = await request(app).get('/api/rooms');
    const room = roomsRes.body.rooms.find((r) => r.roomId === 'nr');
    for (const voter of room.players) {
      await request(app)
        .post('/api/vote')
        .send({ roomId: 'nr', voter, votedFor: room.players[(room.players.indexOf(voter) + 1) % room.players.length] });
    }
    await request(app).get('/api/reveal?roomId=nr');
  }

  beforeEach(setupNextRound);

  it('resets to lobby phase', async () => {
    const res = await request(app).post('/api/next-round').send({ roomId: 'nr' });
    expect(res.status).toBe(200);
    expect(res.body.phase).toBe('lobby');
  });

  it('preserves scores across rounds', async () => {
    const beforeReveal = await request(app).get('/api/reveal?roomId=nr');
    await request(app).post('/api/next-round').send({ roomId: 'nr' });
    const scores = await request(app).get('/api/scores?roomId=nr');
    const totalScore = scores.body.leaderboard.reduce((s, p) => s + p.score, 0);
    expect(totalScore).toBe(
      beforeReveal.body.leaderboard.reduce((s, p) => s + p.score, 0)
    );
  });

  it('returns 400 when not in reveal phase', async () => {
    await request(app).post('/api/rooms').send({ roomId: 'norev' });
    await request(app).post('/api/start-game').send({ roomId: 'norev', players });
    const res = await request(app).post('/api/next-round').send({ roomId: 'norev' });
    expect(res.status).toBe(400);
  });
});

// ─── GET /api/scores ────────────────────────────────────────────────────────

describe('GET /api/scores', () => {
  it('returns leaderboard and round history', async () => {
    await request(app).post('/api/rooms').send({ roomId: 'sc' });
    await request(app).post('/api/start-game').send({ roomId: 'sc', players: ['Alice', 'Bob', 'Carlos'] });
    const res = await request(app).get('/api/scores?roomId=sc');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('leaderboard');
    expect(res.body).toHaveProperty('roundHistory');
    expect(res.body).toHaveProperty('currentRound');
  });

  it('returns 404 for unknown room', async () => {
    const res = await request(app).get('/api/scores?roomId=ghost');
    expect(res.status).toBe(404);
  });
});
