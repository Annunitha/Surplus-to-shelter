const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const impactRoutes = require('./routes/impact');
const donationRoutes = require('./routes/donations');
const recipientRoutes = require('./routes/recipients');
const driverRoutes = require('./routes/drivers');
const { setSocketIo, startTimeoutCascade } = require('./services/matching');
const dispatchService = require('./services/dispatch');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Middleware
app.use(cors());
app.use(express.json());

// Make io accessible to routes and services
app.set('io', io);
setSocketIo(io);
dispatchService.setSocketIo(io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/drivers', driverRoutes);

// Start background timeout cascade runner (check every 3s, default timeout 10s for demo/testing)
const timeoutSec = parseInt(process.env.OFFER_TIMEOUT_SECONDS, 10) || 10;
startTimeoutCascade(3000, timeoutSec);

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Surplus-to-Shelter API',
    database: 'sqlite',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Surplus-to-Shelter API running on port ${PORT}`);
});

module.exports = { app, server, io };
