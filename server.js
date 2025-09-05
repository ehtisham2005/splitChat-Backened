// server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const Group = require('./models/Group'); // used for membership checks

const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || '*';

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());

// Connect DB
connectDB();

// Mount REST routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));

const server = http.createServer(app);

// Setup socket.io with CORS
const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
  },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// expose io so controllers can emit: req.app.locals.io
app.locals.io = io;

// Simple socket auth using JWT. Client should supply handshake.auth.token = "Bearer <token>" or token.
io.use((socket, next) => {
  try {
    let token = null;

    if (socket.handshake && socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    } else if (socket.handshake && socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }

    if (!token) {
      const err = new Error('Authentication error: token required');
      err.data = { code: 'NO_TOKEN' };
      return next(err);
    }

    if (token.startsWith('Bearer ')) token = token.split(' ')[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // attach minimal user info to socket
    socket.user = { id: decoded.id };
    return next();
  } catch (err) {
    console.error('Socket auth error', err.message);
    const err2 = new Error('Authentication error');
    err2.data = { code: 'AUTH_FAILED' };
    return next(err2);
  }
});

// Per-socket message rate limiting variables
const MESSAGE_WINDOW_MS = 10 * 1000; // 10s window
const MESSAGE_LIMIT = 20; // max messages per window

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id} user=${socket.user?.id}`);

  // rate limit state
  socket._msgWindowStart = Date.now();
  socket._msgCount = 0;

  // Helper to check membership for a group (returns true/false)
  async function isMemberOfGroup(groupId, userId) {
    if (!groupId) return false;
    try {
      const group = await Group.findById(groupId).select('members');
      if (!group) return false;
      return group.members.some(m => m.toString() === userId.toString());
    } catch (err) {
      console.error('isMemberOfGroup err', err.message);
      return false;
    }
  }

  // Join a room (client should call socket.emit('join', groupId))
  socket.on('join', async (groupId) => {
    try {
      if (!groupId) return;
      const ok = await isMemberOfGroup(groupId, socket.user.id);
      if (!ok) {
        socket.emit('error', { message: 'Not authorized to join this group' });
        return;
      }
      socket.join(groupId.toString());
      socket.emit('joined', { groupId });
      console.log(`Socket ${socket.id} joined room ${groupId}`);
    } catch (err) {
      console.error('join error', err.message);
      socket.emit('error', { message: 'Join failed' });
    }
  });

  // Leave a room
  socket.on('leave', (groupId) => {
    if (!groupId) return;
    socket.leave(groupId.toString());
    socket.emit('left', { groupId });
    console.log(`Socket ${socket.id} left room ${groupId}`);
  });

  // Optional: client may send a quick chat:send - but recommended to POST to REST endpoint
  socket.on('chat:send', async (payload) => {
    try {
      // payload: { groupId, message } - minimal validation
      const now = Date.now();
      if (now - socket._msgWindowStart > MESSAGE_WINDOW_MS) {
        socket._msgWindowStart = now;
        socket._msgCount = 0;
      }
      socket._msgCount += 1;
      if (socket._msgCount > MESSAGE_LIMIT) {
        socket.emit('error', { message: 'Rate limit exceeded' });
        return;
      }

      if (!payload || !payload.groupId || !payload.message) {
        socket.emit('error', { message: 'Invalid payload' });
        return;
      }

      // verify membership before broadcasting
      const ok = await isMemberOfGroup(payload.groupId, socket.user.id);
      if (!ok) {
        socket.emit('error', { message: 'Not authorized to send to this group' });
        return;
      }

      // Broadcast to the group's room (NOTE: this is ephemeral — doesn't persist)
      io.to(payload.groupId.toString()).emit('chat:new', {
        group: payload.groupId,
        message: payload.message,
        sender: { _id: socket.user.id },
        createdAt: new Date().toISOString(),
        temp: true, // mark as transient if you like
      });

      // Recommended: also call your REST API to persist; server controller will emit the real persisted event.
    } catch (err) {
      console.error('chat:send error', err.message);
      socket.emit('error', { message: 'Send failed' });
    }
  });

  socket.on('disconnect', (reason) => {
    console.log(`Socket disconnected: ${socket.id} reason=${reason}`);
  });
});

// Start server (HTTP + Socket.IO)
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
