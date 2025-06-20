require('dotenv').config();
const http = require("http");
const express = require("express");
const path = require("path");
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(__dirname, "public", "chat.html"));
});

app.post('/chat', (req, res) => {
  const { username, roomCode } = req.body;
  if (!username || !roomCode) {
    return res.redirect('/');
  }
  res.redirect(`/chat?username=${encodeURIComponent(username)}&room=${encodeURIComponent(roomCode)}`);
});

// Socket.io
const rooms = new Map();

io.on('connection', (socket) => {
  // Get username and room from query params
  const { username, room } = socket.handshake.query;
  
  if (!username || !room) {
    socket.disconnect();
    return;
  }

  // Join room
  socket.join(room);
  
  // Add user to room map
  if (!rooms.has(room)) {
    rooms.set(room, new Set());
  }
  rooms.get(room).add(username);

  // Notify room about new user
  io.to(room).emit('user-connected', username);
  io.to(room).emit('update-users', Array.from(rooms.get(room)));

  // Handle messages
  socket.on("user-message", (message) => {
    if (typeof message === 'string' && message.trim()) {
      // In the socket.io 'user-message' handler, change the timestamp line to:
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      io.to(room).emit("message", {
        username,
        message: message.trim(),
        timestamp
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (rooms.has(room)) {
      rooms.get(room).delete(username);
      
      if (rooms.get(room).size === 0) {
        rooms.delete(room);
      } else {
        io.to(room).emit('user-disconnected', username);
        io.to(room).emit('update-users', Array.from(rooms.get(room)));
      }
    }
  });
});

server.listen(PORT, () => {
  console.log('Server running at port', PORT);
});