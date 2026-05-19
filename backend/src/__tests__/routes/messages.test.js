const request = require('supertest');
const express = require('express');
const messageRoutes = require('../../routes/messages');
const gameRoutes = require('../../routes/game');
const { getAllRooms, deleteRoom } = require('../../game/state');

const app = express();
app.use(express.json());
app.use('/api', gameRoutes);
app.use('/api', messageRoutes);

afterEach(() => {
  Object.keys(getAllRooms()).forEach((id) => deleteRoom(id));
});

async function startGame(roomId = 'msg-room', players = ['Alice', 'Bob', 'Carlos']) {
  await request(app).post('/api/rooms').send({ roomId });
  await request(app).post('/api/start-game').send({ roomId, players });
}

// ─── POST /api/message ──────────────────────────────────────────────────────

describe('POST /api/message', () => {
  beforeEach(() => startGame());

  it('stores and returns a message', async () => {
    const res = await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice', text: 'hello everyone' });
    expect(res.status).toBe(200);
    expect(res.body.message.from).toBe('Alice');
    expect(res.body.message.text).toBe('hello everyone');
    expect(res.body.message.id).toBeDefined();
    expect(res.body.message.timestamp).toBeDefined();
  });

  it('returns 400 when playerName is missing', async () => {
    const res = await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', text: 'oops' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when text is missing', async () => {
    const res = await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when the game is not in playing phase', async () => {
    await request(app).post('/api/start-voting').send({ roomId: 'msg-room' });
    const res = await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice', text: 'too late' });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown room', async () => {
    const res = await request(app)
      .post('/api/message')
      .send({ roomId: 'ghost', playerName: 'Alice', text: 'hello' });
    expect(res.status).toBe(404);
  });
});

// ─── GET /api/messages ──────────────────────────────────────────────────────

describe('GET /api/messages', () => {
  beforeEach(() => startGame());

  it('returns all public messages', async () => {
    await request(app).post('/api/message').send({ roomId: 'msg-room', playerName: 'Alice', text: 'hi' });
    await request(app).post('/api/message').send({ roomId: 'msg-room', playerName: 'Bob', text: 'hey' });
    const res = await request(app).get('/api/messages?roomId=msg-room');
    expect(res.status).toBe(200);
    expect(res.body.messages.length).toBe(2);
  });

  it('hides private messages when no viewer is specified', async () => {
    await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice', text: 'public' });
    await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice', text: 'secret', isPrivate: true, to: 'Bob' });
    const res = await request(app).get('/api/messages?roomId=msg-room');
    expect(res.body.messages.length).toBe(1);
    expect(res.body.messages[0].text).toBe('public');
  });

  it('shows private messages to the sender', async () => {
    await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice', text: 'secret', isPrivate: true, to: 'Bob' });
    const res = await request(app).get('/api/messages?roomId=msg-room&viewer=Alice');
    expect(res.body.messages.length).toBe(1);
  });

  it('shows private messages to the recipient', async () => {
    await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice', text: 'secret', isPrivate: true, to: 'Bob' });
    const res = await request(app).get('/api/messages?roomId=msg-room&viewer=Bob');
    expect(res.body.messages.length).toBe(1);
  });

  it('hides private messages from uninvolved players', async () => {
    await request(app)
      .post('/api/message')
      .send({ roomId: 'msg-room', playerName: 'Alice', text: 'secret', isPrivate: true, to: 'Bob' });
    const res = await request(app).get('/api/messages?roomId=msg-room&viewer=Carlos');
    expect(res.body.messages.length).toBe(0);
  });

  it('returns 404 for unknown room', async () => {
    const res = await request(app).get('/api/messages?roomId=ghost');
    expect(res.status).toBe(404);
  });

  it('includes the current phase in the response', async () => {
    const res = await request(app).get('/api/messages?roomId=msg-room');
    expect(res.body.phase).toBe('playing');
  });
});
