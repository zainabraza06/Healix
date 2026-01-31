import express from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import routes from './routes/index.js';
import errorHandler from './middleware/errorHandler.js';
import config from './config/index.js';
import { initSocket } from './config/socket.js';
import { initializeScheduler } from './services/schedulerService.js';

dotenv.config();

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: config.corsOrigins,
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api', routes);

// Error handler (must be last)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start server with Socket.IO
const PORT = config.port;
const server = http.createServer(app);
initSocket(server, config.corsOrigins);
server.listen(PORT, async () => {
  console.log(`\nServer is running on port ${PORT}`);
  // Initialize all scheduled jobs
  initializeScheduler();
});

export default app;
