import { createClient } from 'redis';
import dotenv from 'dotenv';
dotenv.config();

export const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
export const pubClient = redisClient.duplicate();
export const subClient = redisClient.duplicate();

export const initRedis = async () => {
  try {
    await redisClient.connect();
    await pubClient.connect();
    await subClient.connect();
    console.log('Redis clients connected successfully.');
  } catch (error) {
    console.error('Redis connection failed (Continuing without Redis for now):', error);
  }
};
