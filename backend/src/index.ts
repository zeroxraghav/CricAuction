import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createAdapter } from '@socket.io/redis-adapter';
import { initRedis, pubClient, subClient } from './redis';
import { setupSockets } from './sockets';
import auctionsRoutes from './routes/auctions';
import publicRoutes from './routes/public';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

import { clerkMiddleware } from '@clerk/express';
app.use(clerkMiddleware());

// Set up Socket.io with Redis adapter
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
});

const startServer = async () => {
  await initRedis();
  
  // Set up Redis Adapter if clients are ready
  try {
    if (pubClient.isOpen && subClient.isOpen) {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Redis adapter initialized for Socket.io');
    } else {
      console.log('Redis clients are not open. Socket will run in memory.');
    }
  } catch (error) {
    console.error('Redis adapter failed. Socket will run in memory.', error);
  }

  // Setup Socket Events
  setupSockets(io);

  // Routes
  app.use('/api/auctions', (req, res, next) => {
    (req as any).io = io;
    next();
  }, auctionsRoutes);
  app.use('/api/public', publicRoutes);

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  httpServer.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

startServer().catch(console.error);
