const { v4: uuidv4 } = require('uuid');
const { getOrCreateRoom, getRoom } = require('../game/state');

function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    // --- Join room ---
    socket.on('join_room', ({ roomId = 'default', playerName }) => {
      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.playerName = playerName;

      const room = getOrCreateRoom(roomId);

      if (!room.players.find((p) => p.name === playerName)) {
        room.players.push({ name: playerName, socketId: socket.id });
      } else {
        const p = room.players.find((p) => p.name === playerName);
        p.socketId = socket.id;
      }

      io.to(roomId).emit('player_joined', {
        playerName,
        players: room.players.filter((p) => !p.isAI).map((p) => p.name),
        phase: room.phase,
      });
    });

    // --- Send message ---
    // Used by human players AND by the Claude service (teammate 4) to inject AI responses.
    // Claude service should send: { text, playerName: room.aiPlayerName }
    socket.on('send_message', ({ text, isPrivate = false, to = null }) => {
      const { roomId, playerName } = socket.data;
      const room = getRoom(roomId);

      if (!room || room.phase !== 'playing') return;

      const message = {
        id: uuidv4(),
        from: playerName,
        text,
        timestamp: new Date().toISOString(),
        isPrivate,
        to,
      };

      room.messages.push(message);

      // Track stress when the AI player is mentioned or accused
      if (room.hasAI && text.toLowerCase().includes(room.aiPlayerName.toLowerCase())) {
        room.claudeStress = Math.min(100, room.claudeStress + 5);
      }

      if (isPrivate && to) {
        const recipient = room.players.find((p) => p.name === to);
        socket.emit('new_message', message);
        if (recipient?.socketId) {
          io.to(recipient.socketId).emit('new_message', message);
        }
      } else {
        io.to(roomId).emit('new_message', message);
      }
    });

    // --- Accusation (public) ---
    socket.on('accuse', ({ accused }) => {
      const { roomId, playerName } = socket.data;
      const room = getRoom(roomId);
      if (!room) return;

      if (room.hasAI && accused === room.aiPlayerName) {
        room.claudeStress = Math.min(100, room.claudeStress + 20);
      }

      io.to(roomId).emit('accusation', {
        accuser: playerName,
        accused,
        claudeStress: room.hasAI ? room.claudeStress : null,
      });
    });

    // --- Phase change broadcast ---
    socket.on('phase_change', ({ roomId = 'default' }) => {
      const room = getRoom(roomId);
      if (!room) return;
      io.to(roomId).emit('phase_updated', { phase: room.phase });
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      const { roomId, playerName } = socket.data;
      if (!roomId || !playerName) return;
      const room = getRoom(roomId);
      if (!room) return;
      io.to(roomId).emit('player_disconnected', { playerName });
    });
  });
}

module.exports = { registerSocketHandlers };
