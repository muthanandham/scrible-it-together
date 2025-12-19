import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { createWebSocketServer } from './websocket/server.js';
import { createRoomsRouter } from './api/rooms.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:8080';

async function main() {
  // Initialize Prisma
  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('[DB] Connected to PostgreSQL');

  // Create Express app
  const app = express();
  
  // Middleware
  app.use(cors({
    origin: CORS_ORIGIN,
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // REST API routes
  app.use('/api/rooms', createRoomsRouter(prisma));

  // Create HTTP server
  const server = createServer(app);

  // Initialize WebSocket server
  const { connectionManager, yjsManager } = createWebSocketServer(server, prisma);

  // Stats endpoint
  app.get('/api/stats', (req, res) => {
    res.json({
      connections: connectionManager.getStats(),
      activeDocuments: yjsManager.getActiveRoomCount(),
    });
  });

  // Start server
  server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           Scrible_it Backend Server Started               ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP:      http://localhost:${PORT}                        ║
║  WebSocket: ws://localhost:${PORT}/ws                       ║
║  CORS:      ${CORS_ORIGIN.padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n[Server] Shutting down...');
    
    server.close(() => {
      console.log('[Server] HTTP server closed');
    });

    await prisma.$disconnect();
    console.log('[DB] Disconnected from PostgreSQL');
    
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error('[Server] Failed to start:', error);
  process.exit(1);
});
