const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const connectDB = require('./config/db');

require('dotenv').config();
const PORT = process.env.PORT || 5000;


const app = express();
app.use(cors());
app.use(express.json());

// Connect DB
connectDB();

// Routes
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/groups', require('./routes/groupRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/chats', require('./routes/chatRoutes'));

const server = http.createServer(app);

// Setup socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('chatMessage', (msg) => {
    io.emit('chatMessage', msg);
  });

  socket.on('splitExpense', (expense) => {
    io.emit('splitExpense', expense);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});


server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
