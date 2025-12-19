import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { PrismaClient } from '@prisma/client';
import { ConnectionManager } from './connection-manager.js';
import { MessageHandler } from './message-handler.js';
import { YjsDocumentManager } from '../yjs/document-manager.js';
import { v4 as uuidv4 } from 'crypto';

export function createWebSocketServer(server: Server, prisma: PrismaClient) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  
  const connectionManager = new ConnectionManager();
  const yjsManager = new YjsDocumentManager(prisma);
  const messageHandler = new MessageHandler(connectionManager, yjsManager, prisma);

  wss.on('connection', (ws: WebSocket, req) => {
    const clientId = `client_${crypto.randomUUID()}`;
    console.log(`[WS] New connection: ${clientId}`);

    // Set up ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 30000);

    ws.on('message', async (data: Buffer) => {
      await messageHandler.handleMessage(clientId, ws, data.toString());
    });

    ws.on('close', async () => {
      console.log(`[WS] Connection closed: ${clientId}`);
      clearInterval(pingInterval);
      await messageHandler.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      console.error(`[WS] Error for ${clientId}:`, error);
    });

    ws.on('pong', () => {
      // Connection is alive
    });
  });

  // Log stats periodically
  setInterval(() => {
    const stats = connectionManager.getStats();
    console.log(`[WS Stats] Connections: ${stats.totalConnections}, Rooms: ${stats.totalRooms}`);
  }, 60000);

  console.log('[WS] WebSocket server initialized');

  return {
    wss,
    connectionManager,
    yjsManager,
  };
}
