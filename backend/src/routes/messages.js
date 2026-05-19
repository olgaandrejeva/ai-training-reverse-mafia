const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getRoom } = require('../game/state');

// POST /api/message
// Body: { roomId, playerName, text, isPrivate?, to? }
// Note: Claude responses are handled via Socket.io, not this endpoint.
// This endpoint stores the message and returns it (for REST-only clients).
router.post('/message', (req, res) => {
  const { roomId = 'default', playerName, text, isPrivate = false, to = null } = req.body;
  const room = getRoom(roomId);

  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.phase !== 'playing') {
    return res.status(400).json({ error: 'Game is not in playing phase' });
  }
  if (!playerName || !text) {
    return res.status(400).json({ error: 'playerName and text are required' });
  }

  const message = {
    id: uuidv4(),
    from: playerName,
    text,
    timestamp: new Date().toISOString(),
    isPrivate,
    to,
  };

  room.messages.push(message);

  res.json({ message });
});

// GET /api/messages?roomId=default
router.get('/messages', (req, res) => {
  const { roomId = 'default' } = req.query;
  const room = getRoom(roomId);

  if (!room) return res.status(404).json({ error: 'Room not found' });

  // Private messages are only visible to sender and recipient — filter by caller if provided
  const { viewer } = req.query;
  const messages = viewer
    ? room.messages.filter((m) => !m.isPrivate || m.from === viewer || m.to === viewer)
    : room.messages.filter((m) => !m.isPrivate);

  res.json({ messages, phase: room.phase });
});

module.exports = router;
