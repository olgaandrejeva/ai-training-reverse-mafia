// Single source of truth for all active rooms (in-memory, no DB)
const rooms = {};

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function createRoom(roomId) {
  rooms[roomId] = {
    phase: 'lobby',          // lobby | playing | voting | reveal
    players: [],             // [{ name, socketId }]
    roles: {},               // { playerName: 'human' | 'robot-human' | 'ai' | 'mole' }
    aiPlayerName: null,      // fake human name Claude uses
    hasAI: false,
    messages: [],            // [{ id, from, text, timestamp, isPrivate, to }]
    votes: {},               // { voter: votedFor }
    claudeStress: 0,         // 0–100, rises when Claude is accused
    claudePersonality: null, // assigned at start-game
    startedAt: null,
    revealedAt: null,
    currentRound: 0,
    scores: {},              // { playerName: totalScore }
    rounds: [],              // snapshot of each completed round
  };
  return rooms[roomId];
}

function getOrCreateRoom(roomId) {
  return getRoom(roomId) || createRoom(roomId);
}

function deleteRoom(roomId) {
  delete rooms[roomId];
}

function getAllRooms() {
  return rooms;
}

module.exports = { getRoom, createRoom, getOrCreateRoom, deleteRoom, getAllRooms };
