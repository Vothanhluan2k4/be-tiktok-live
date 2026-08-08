import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import apiRoutes from './routes/api.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const PORT = process.env.PORT || 5000;

// Enable CORS for client / OBS source
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json());

// Setup Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Attach Socket.IO to app context for controllers
app.set('io', io);

// Socket.IO Room Management
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  // Overlay client joins room using its overlayToken
  socket.on('join_overlay', (data) => {
    const token = typeof data === 'string' ? data : data?.overlayToken;
    if (token) {
      socket.join(token);
      console.log(`[Socket.IO] Socket ${socket.id} joined room token: [${token}]`);
      socket.emit('connection_status', {
        status: 'ready',
        message: 'Đã kết nối Socket.IO Overlay Widget',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// API Routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'TikTok Live Comment/Gift TTS Reader API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Attempt optional MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/tiktok_live_tts';
mongoose.connect(MONGO_URI)
  .then(() => console.log('[MongoDB] Connected successfully to Database'))
  .catch((err) => {
    console.log('[MongoDB] Local MongoDB connection skipped (running in high-speed In-Memory mode):', err.message);
  });

httpServer.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 TikTok Live TTS Reader Server running on http://localhost:${PORT}`);
  console.log(`====================================================`);
});
