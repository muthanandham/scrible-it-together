import { WebSocket } from 'ws';
import { PrismaClient } from '@prisma/client';
import { ConnectionManager } from './connection-manager.js';
import { YjsDocumentManager } from '../yjs/document-manager.js';
import {
  ClientMessage,
  ConnectMessage,
  UpdateMessage,
  PresenceMessage,
  ChatMessage,
} from '../types.js';

export class MessageHandler {
  constructor(
    private connectionManager: ConnectionManager,
    private yjsManager: YjsDocumentManager,
    private prisma: PrismaClient
  ) {}

  async handleMessage(clientId: string, ws: WebSocket, data: string) {
    try {
      const message: ClientMessage = JSON.parse(data);
      console.log(`[WS] Received ${message.type} from ${clientId}`);

      switch (message.type) {
        case 'connect':
          await this.handleConnect(clientId, ws, message);
          break;
        case 'update':
          await this.handleUpdate(clientId, message);
          break;
        case 'presence':
          await this.handlePresence(clientId, message);
          break;
        case 'chat':
          await this.handleChat(clientId, message);
          break;
        case 'heartbeat':
          // Respond to heartbeat
          this.connectionManager.sendToClient(clientId, {
            type: 'heartbeat' as any,
            timestamp: Date.now(),
          });
          break;
        case 'leave':
          await this.handleDisconnect(clientId);
          break;
      }
    } catch (error) {
      console.error(`[WS] Error handling message from ${clientId}:`, error);
      this.connectionManager.sendToClient(clientId, {
        type: 'error',
        code: 'INVALID_MESSAGE',
        message: 'Failed to process message',
      });
    }
  }

  async handleConnect(clientId: string, ws: WebSocket, message: ConnectMessage) {
    const { roomId, user } = message;

    // Validate/create room in database
    let room = await this.prisma.room.findUnique({ where: { id: roomId } });
    
    if (!room) {
      // Auto-create room if it doesn't exist
      room = await this.prisma.room.create({
        data: {
          id: roomId,
          name: `Room ${roomId}`,
          creatorId: user.id,
        },
      });
      console.log(`[WS] Created new room: ${roomId}`);
    }

    // Update room last active
    await this.prisma.room.update({
      where: { id: roomId },
      data: { lastActive: new Date() },
    });

    // Add connection
    this.connectionManager.addConnection(clientId, ws, roomId, user);

    // Record participant
    await this.prisma.roomParticipant.create({
      data: {
        roomId,
        userId: user.id,
        clientId,
        userName: user.name,
        userColor: user.color,
        role: 'editor',
      },
    });

    // Get/create Yjs document
    await this.yjsManager.getOrCreateDocument(roomId);

    // Send current document state
    const state = this.yjsManager.getStateAsUpdate(roomId);
    const participants = this.connectionManager.getRoomParticipants(roomId);

    if (state) {
      this.connectionManager.sendToClient(clientId, {
        type: 'sync-response',
        snapshotData: Buffer.from(state).toString('base64'),
        participants,
      });
    }

    // Broadcast join to other clients
    this.connectionManager.broadcastToRoom(
      roomId,
      {
        type: 'join',
        user,
        clientId,
        roomId,
      },
      clientId
    );
  }

  async handleUpdate(clientId: string, message: UpdateMessage) {
    const roomId = this.connectionManager.getRoomId(clientId);
    if (!roomId) return;

    // Decode and apply Yjs update
    const update = Buffer.from(message.delta, 'base64');
    this.yjsManager.applyUpdate(roomId, new Uint8Array(update));

    // Broadcast to other clients
    this.connectionManager.broadcastToRoom(
      roomId,
      {
        type: 'update',
        delta: message.delta,
        from: clientId,
      },
      clientId
    );
  }

  async handlePresence(clientId: string, message: PresenceMessage) {
    const roomId = this.connectionManager.getRoomId(clientId);
    if (!roomId) return;

    // Broadcast presence to other clients
    this.connectionManager.broadcastToRoom(
      roomId,
      {
        type: 'presence',
        clientId,
        cursor: message.cursor,
        selection: message.selection,
        viewport: message.viewport,
      },
      clientId
    );
  }

  async handleChat(clientId: string, message: ChatMessage) {
    const roomId = this.connectionManager.getRoomId(clientId);
    if (!roomId) return;

    // Broadcast chat to all clients in room (including sender)
    this.connectionManager.broadcastToRoom(roomId, {
      type: 'chat' as any,
      userName: message.userName,
      message: message.message,
      timestamp: message.timestamp,
      clientId,
    });
  }

  async handleDisconnect(clientId: string) {
    const result = this.connectionManager.removeConnection(clientId);
    if (!result) return;

    const { roomId, user } = result;

    // Update participant record
    await this.prisma.roomParticipant.updateMany({
      where: { clientId, leftAt: null },
      data: { leftAt: new Date() },
    });

    // Broadcast leave to room
    this.connectionManager.broadcastToRoom(roomId, {
      type: 'leave',
      clientId,
      userId: user.id,
    });

    // If room is empty, save snapshot and optionally destroy document
    if (this.connectionManager.isRoomEmpty(roomId)) {
      console.log(`[WS] Room ${roomId} is empty, saving final snapshot`);
      await this.yjsManager.saveSnapshot(roomId);
      
      // Optionally destroy document after delay to free memory
      // setTimeout(() => {
      //   if (this.connectionManager.isRoomEmpty(roomId)) {
      //     this.yjsManager.destroyDocument(roomId);
      //   }
      // }, 60000); // 1 minute delay
    }
  }
}
