require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { registerSocketHandlers } = require('./src/sockets');
const { startClaudeBot } = require('./src/claude/bot');
const gameRoutes = require('./src/routes/game');
const messageRoutes = require('./src/routes/messages');

const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

app.use('/api', gameRoutes);
app.use('/api', messageRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

registerSocketHandlers(io);
startClaudeBot(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
