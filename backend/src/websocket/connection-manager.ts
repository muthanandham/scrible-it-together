import { WebSocket } from 'ws';
import { User, ServerMessage, Participant } from '../types.js';

interface ClientConnection {
  ws: WebSocket;
  roomId: string;
  user: User;
  joinedAt: Date;
}

export class ConnectionManager {
  private connections = new Map<string, ClientConnection>();
  private roomClients = new Map<string, Set<string>>();

  addConnection(clientId: string, ws: WebSocket, roomId: string, user: User) {
    this.connections.set(clientId, {
      ws,
      roomId,
      user,
      joinedAt: new Date(),
    });

    // Track clients per room
    if (!this.roomClients.has(roomId)) {
      this.roomClients.set(roomId, new Set());
    }
    this.roomClients.get(roomId)!.add(clientId);

    console.log(`[WS] Client ${clientId} (${user.name}) joined room ${roomId}`);
  }

  removeConnection(clientId: string): { roomId: string; user: User } | null {
    const connection = this.connections.get(clientId);
    if (!connection) return null;

    const { roomId, user } = connection;

    // Remove from room tracking
    const roomSet = this.roomClients.get(roomId);
    if (roomSet) {
      roomSet.delete(clientId);
      if (roomSet.size === 0) {
        this.roomClients.delete(roomId);
      }
    }

    this.connections.delete(clientId);
    console.log(`[WS] Client ${clientId} (${user.name}) left room ${roomId}`);

    return { roomId, user };
  }

  getRoomId(clientId: string): string | undefined {
    return this.connections.get(clientId)?.roomId;
  }

  getUser(clientId: string): User | undefined {
    return this.connections.get(clientId)?.user;
  }

  getRoomClientCount(roomId: string): number {
    return this.roomClients.get(roomId)?.size || 0;
  }

  getRoomParticipants(roomId: string): Participant[] {
    const participants: Participant[] = [];
    const clientIds = this.roomClients.get(roomId);

    if (clientIds) {
      for (const clientId of clientIds) {
        const connection = this.connections.get(clientId);
        if (connection) {
          participants.push({
            userId: connection.user.id,
            clientId,
            user: connection.user,
            role: 'editor',
            joinedAt: connection.joinedAt.toISOString(),
          });
        }
      }
    }

    return participants;
  }

  broadcastToRoom(roomId: string, message: ServerMessage, excludeClientId?: string) {
    const clientIds = this.roomClients.get(roomId);
    if (!clientIds) return;

    const messageStr = JSON.stringify(message);

    for (const clientId of clientIds) {
      if (clientId === excludeClientId) continue;

      const connection = this.connections.get(clientId);
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
      }
    }
  }

  sendToClient(clientId: string, message: ServerMessage) {
    const connection = this.connections.get(clientId);
    if (connection && connection.ws.readyState === WebSocket.OPEN) {
      connection.ws.send(JSON.stringify(message));
    }
  }

  isRoomEmpty(roomId: string): boolean {
    return this.getRoomClientCount(roomId) === 0;
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      totalRooms: this.roomClients.size,
      roomStats: Array.from(this.roomClients.entries()).map(([roomId, clients]) => ({
        roomId,
        clientCount: clients.size,
      })),
    };
  }
}
