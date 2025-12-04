require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const routes = require('./routes/routes');
const deepseekRouter = require('./routes/deepseek');
const geminiRouter = require('./routes/gemini');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);
app.use('/api', deepseekRouter);
app.use('/api', geminiRouter);

// quick health endpoint for frontend/dev checks
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// simple realtime channel for vehicle location updates
io.on('connection', socket => {
  console.log('socket connected', socket.id);
  socket.on('join-route', routeId => {
    socket.join(routeId);
  });
  socket.on('vehicle-update', ({ routeId, lat, lng }) => {
    io.to(routeId).emit('vehicle-location', { lat, lng, ts: Date.now() });
  });
  socket.on('disconnect', () => console.log('socket disconnected', socket.id));
});

// Connect to MongoDB (optional in dev)
const MONGO_URI = process.env.MONGO_URI;
if (MONGO_URI && (MONGO_URI.startsWith('mongodb://') || MONGO_URI.startsWith('mongodb+srv://'))) {
  mongoose.connect(MONGO_URI, { useNewUrlParser:true, useUnifiedTopology:true })
    .then(()=> console.log('MongoDB connected'))
    .catch(err=> console.error('MongoDB connection error:', err));
} else {
  console.warn('No valid MONGO_URI provided — skipping MongoDB connection. Set MONGO_URI in backend/.env to enable DB features.');
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, ()=> console.log(`Server running on ${PORT}`));
