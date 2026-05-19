const { v4: uuidv4 } = require('uuid');
const express = require('express');
const router = express.Router();
const { getOrCreateRoom, getRoom, createRoom, getAllRooms } = require('../game/state');
const { assignRoles, getRoleInstruction } = require('../game/roles');
const { transition } = require('../game/stateMachine');
const { calculateRoundScores, applyScores, getSortedLeaderboard } = require('../game/scoring');

// POST /api/start-game
// Body: { roomId, players: ['Alice', 'Bob', ...] }
router.post('/start-game', (req, res) => {
  const { roomId = 'default', players } = req.body;

  if (!players || players.length < 3) {
    return res.status(400).json({ error: 'Need at least 3 players' });
  }

  const room = getOrCreateRoom(roomId);

  if (room.phase !== 'lobby') {
    return res.status(400).json({ error: `Game already in phase: ${room.phase}` });
  }

  const { roles, aiPlayerName, hasAI, claudePersonality } = assignRoles(players);

  room.players = players.map((name) => ({ name }));
  room.roles = roles;
  room.aiPlayerName = aiPlayerName;
  room.hasAI = hasAI;
  room.claudePersonality = claudePersonality;
  room.messages = [];
  room.votes = {};
  room.claudeStress = 0;
  room.currentRound += 1;

  // Initialize scores for new players
  players.forEach((name) => {
    if (room.scores[name] === undefined) room.scores[name] = 0;
  });

  transition(room, 'playing');

  const playerInstructions = {};
  players.forEach((name) => {
    playerInstructions[name] = getRoleInstruction(roles[name], aiPlayerName);
  });

  if (hasAI) {
    room.players.push({ name: aiPlayerName, isAI: true });
  }

  res.json({
    roomId,
    phase: room.phase,
    currentRound: room.currentRound,
    players: room.players.map((p) => p.name),
    hasAI,
    playerInstructions,
    claudePersonality: hasAI ? claudePersonality : null,
  });
});

// POST /api/vote
// Body: { roomId, voter, votedFor }
router.post('/vote', (req, res) => {
  const { roomId = 'default', voter, votedFor } = req.body;
  const room = getRoom(roomId);

  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.phase !== 'voting') {
    return res.status(400).json({ error: 'Not in voting phase' });
  }

  room.votes[voter] = votedFor;

  if (room.hasAI && votedFor === room.aiPlayerName) {
    room.claudeStress = Math.min(100, room.claudeStress + 15);
  }

  const realPlayers = room.players.filter((p) => !p.isAI).map((p) => p.name);
  const allVoted = realPlayers.every((name) => room.votes[name]);

  if (allVoted) {
    transition(room, 'reveal');
  }

  res.json({
    voter,
    votedFor,
    phase: room.phase,
    votesIn: Object.keys(room.votes).length,
    totalVoters: realPlayers.length,
  });
});

// GET /api/reveal?roomId=default
router.get('/reveal', (req, res) => {
  const { roomId = 'default' } = req.query;
  const room = getRoom(roomId);

  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.phase !== 'reveal') {
    return res.status(400).json({ error: 'Game not yet in reveal phase' });
  }

  const tally = {};
  Object.values(room.votes).forEach((votedFor) => {
    tally[votedFor] = (tally[votedFor] || 0) + 1;
  });

  const mostVoted = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
  const aiWon = room.hasAI && mostVoted !== room.aiPlayerName;

  // Calculate and persist scores for this round
  const roundDelta = calculateRoundScores(room, mostVoted);
  applyScores(room, roundDelta);

  // Save round snapshot
  room.rounds.push({
    round: room.currentRound,
    hasAI: room.hasAI,
    aiPlayerName: room.aiPlayerName,
    claudePersonality: room.claudePersonality,
    roles: { ...room.roles },
    votes: { ...room.votes },
    tally: { ...tally },
    mostVoted,
    aiWon,
    claudeStressPeak: room.claudeStress,
    scoreDelta: roundDelta,
  });

  res.json({
    roomId,
    currentRound: room.currentRound,
    hasAI: room.hasAI,
    aiPlayerName: room.aiPlayerName,
    claudePersonality: room.claudePersonality,
    roles: room.roles,
    votes: room.votes,
    tally,
    mostVoted,
    aiWon,
    claudeStressPeak: room.claudeStress,
    scoreDelta: roundDelta,
    leaderboard: getSortedLeaderboard(room.scores),
  });
});

// POST /api/start-voting
// Body: { roomId }
router.post('/start-voting', (req, res) => {
  const { roomId = 'default' } = req.body;
  const room = getRoom(roomId);

  if (!room) return res.status(404).json({ error: 'Room not found' });

  transition(room, 'voting');
  res.json({ roomId, phase: room.phase });
});

// POST /api/next-round
// Resets round state but keeps players and scores.
// Body: { roomId }
router.post('/next-round', (req, res) => {
  const { roomId = 'default' } = req.body;
  const room = getRoom(roomId);

  if (!room) return res.status(404).json({ error: 'Room not found' });
  if (room.phase !== 'reveal') {
    return res.status(400).json({ error: 'Can only advance to next round from reveal phase' });
  }

  // Strip AI virtual player, keep real players
  room.players = room.players.filter((p) => !p.isAI);
  room.roles = {};
  room.aiPlayerName = null;
  room.hasAI = false;
  room.claudePersonality = null;
  room.messages = [];
  room.votes = {};
  room.claudeStress = 0;
  room.startedAt = null;
  room.revealedAt = null;

  transition(room, 'lobby');

  res.json({
    roomId,
    phase: room.phase,
    currentRound: room.currentRound,
    nextRound: room.currentRound + 1,
    leaderboard: getSortedLeaderboard(room.scores),
  });
});

// GET /api/scores?roomId=default
router.get('/scores', (req, res) => {
  const { roomId = 'default' } = req.query;
  const room = getRoom(roomId);

  if (!room) return res.status(404).json({ error: 'Room not found' });

  res.json({
    roomId,
    currentRound: room.currentRound,
    leaderboard: getSortedLeaderboard(room.scores),
    roundHistory: room.rounds.map((r) => ({
      round: r.round,
      mostVoted: r.mostVoted,
      aiWon: r.aiWon,
      hasAI: r.hasAI,
      scoreDelta: r.scoreDelta,
    })),
  });
});

// GET /api/rooms
router.get('/rooms', (_req, res) => {
  const rooms = getAllRooms();
  const summary = Object.entries(rooms).map(([roomId, room]) => ({
    roomId,
    phase: room.phase,
    currentRound: room.currentRound,
    players: room.players.filter((p) => !p.isAI).map((p) => p.name),
    playerCount: room.players.filter((p) => !p.isAI).length,
    startedAt: room.startedAt,
  }));
  res.json({ rooms: summary });
});

// POST /api/rooms
// Body: { roomId? }
router.post('/rooms', (req, res) => {
  const roomId = req.body?.roomId || uuidv4().slice(0, 8);

  if (getAllRooms()[roomId]) {
    return res.status(409).json({ error: 'Room already exists', roomId });
  }

  createRoom(roomId);
  res.status(201).json({ roomId, phase: 'lobby' });
});

module.exports = router;
